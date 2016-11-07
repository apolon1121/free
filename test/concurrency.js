const { test } = require('tap')
const {
  Concurrent,
  Identity, Future, FutureAp,
  ap, lift2, lift3,
} = require('./lib')

const delay = (val, ms) => (rej, res) => setTimeout(res, ms, val)
const shoutSeq = (tag, ms) => Concurrent.lift({tag: `${tag}.${ms}`, ms})
const shout = (tag, ms) => Concurrent.lift({tag: `${tag}.${ms}`, ms}).par()
const pear3 = x => y => z => [x, y, z]

const interpreter = {
  runSeq: ({tag, ms}) => Future(delay(tag, ms)),
  runPar: ({tag, ms}) => FutureAp(delay(tag, ms)),
  seqToPar: a => a.par(),
  parToSeq: a => a.seq(),
  Seq: Future,
  Par: FutureAp,
}

const futureEq = (t, expectedDuration, expectedResult, name, val) => {
  const now = new Date().getTime()
  val.interpret(interpreter).fork(t.fail, a => {
    const end = new Date().getTime()
    const duration = end - now
    t.same(a, expectedResult)
    t.eqWithAccuracy(duration, expectedDuration, 25)
  })
}

test('triangle', (t) => {
  const cases = [
    {
      result: 'a.100.200',
      duration: 300,
      fragment: shoutSeq('a', 100).chain(a => shoutSeq(a, 200)),
    },
    {
      result: 'a.100',
      duration: 100,
      fragment: shoutSeq('a', 100),
    },
    {
      result: 'a.100a.200a.100a.200.50',
      duration: 250,
      fragment: lift2(a => b => a + b, shout('a', 100), shout('a', 200)).seq().chain(v => shout(v + v, 50).seq()).up(),
    },
    {
      result: 'a.100a.200a.100',
      duration: 200,
      fragment: lift2(a => b => a + b, lift2(a => b => a + b, shout('a', 100), shout('a', 200)), shout('a', 100)).up(),
    },
    {
      result: 'a.100a.200a.100',
      duration: 200,
      fragment: lift2(a => b => a + b, lift2(a => b => a + b, shout('a', 100).up().par(), shout('a', 200)), shout('a', 100)).up(),
    },
    {
      result: 'a.100a.200a.100a.200.50',
      duration: 250,
      fragment: lift2(a => b => a + b, shout('a', 100), shout('a', 200)).up().chain(v => shout(v + v, 50)),
    },
    {
      result: 'a.100.200b.100',
      duration: 300,
      fragment: lift2(a => b => a + b, shoutSeq('a', 100).chain(a => shoutSeq(a, 200)).par(), shout('b', 100)).up(),
    },
  ]

  t.plan(cases.length * 2)
  cases.forEach(({ result, duration, fragment }) => {
    futureEq(t, duration, result, `${result}-${duration}`, fragment)
  })
})

test('triangle', (t) => {
  t.same(Concurrent.lift(1).par().seq().up().foldMap(Identity, Identity), Identity(1))
  t.same(Concurrent.of(1).par().seq().up().foldMap(Identity, Identity), Identity(1))
  t.same(Concurrent.of(1).seq().par().up().foldMap(Identity, Identity), Identity(1))
  t.same(Concurrent.of(1).par().up().seq().up().foldMap(Identity, Identity), Identity(1))
  t.same(Concurrent.of(1).par().up().par().up().foldMap(Identity, Identity), Identity(1))
  t.end()
})

test('Future and FutureAp', (t) => {
  t.plan(4)

  const timetest = (t, expectedDuration, name, val) => {
    const now = new Date().getTime()
    val.fork(t.fail, a => {
      const end = new Date().getTime()
      const duration = end - now
      t.eqWithAccuracy(duration, expectedDuration, 15)
    })
  }

  timetest(t, 200, 'Future', lift2(a => b => a + b, Future(delay(1, 100)), Future(delay(1, 100))))
  timetest(t, 100, 'FutureAp', lift2(a => b => a + b, FutureAp(delay(1, 100)), FutureAp(delay(1, 100))))
  timetest(t, 100, 'Future.par()', lift2(a => b => a + b, Future(delay(1, 100)).par(), Future(delay(1, 100)).par()))
  timetest(t, 200, 'FutureAp.seq()', lift2(a => b => a + b, FutureAp(delay(1, 100)).seq(), FutureAp(delay(1, 100)).seq()))
})

test('Check for concurrency', (t) => {
  let orders = { start: [], end: [] }
  let tre = ap(
    lift3(
      pear3,
      shout('out.ap', 500),
      shout('out.ap', 400),
      lift3(
        pear3,
        shout('out.ap', 100),
        shout('out.ap', 300),
        shout('out.ap', 200)
      ).seq().chain((tout) =>
        lift3(pear3,
          shout('in.ap', 50),
          shout('in.ap', 250),
          shout('in.ap', 150)
        ).map((tin) => [tout, tin]).seq()
      ).par()
    ).seq().chain((tout) =>
      lift2(pear3,
        shout('in.ap', 40),
        shout('in.ap', 140)
      ).map((f) => (a) => [tout, f(a)]).seq()
    ).par(),
    shout('out.ap', 10).ap(Concurrent.of((a) => a).par())
  )
  .up()

  const actionToComp = ({tag, ms}) => {
    return (rej, res) => {
      orders.start.push(tag)
      setTimeout(() => {
        orders.end.push(tag)
        res(tag)
      }, ms)
    }
  }

  const interpreter = {
    runSeq: (inst) => Future(actionToComp(inst)),
    runPar: (inst) => FutureAp(actionToComp(inst)),
    seqToPar: a => a.par(),
    parToSeq: a => a.seq(),
    Seq: Future,
    Par: FutureAp,
  }

  tre.interpret(interpreter)
    .fork(t.fail, (result) => {
      t.same(orders, {
        end: [
          'out.ap.10',
          'out.ap.100',
          'out.ap.200',
          'out.ap.300',
          'in.ap.50',
          'out.ap.400',
          'in.ap.150',
          'out.ap.500',
          'in.ap.250',
          'in.ap.40',
          'in.ap.140',
        ],
        start: [
          'out.ap.10',
          'out.ap.200',
          'out.ap.300',
          'out.ap.100',
          'out.ap.400',
          'out.ap.500',
          'in.ap.150',
          'in.ap.250',
          'in.ap.50',
          'in.ap.140',
          'in.ap.40',
        ],
      }, 'start and end order to be preserved')

      t.same(result, [
        ['out.ap.500', 'out.ap.400', [
          ['out.ap.100', 'out.ap.300', 'out.ap.200'],
          ['in.ap.50', 'in.ap.250', 'in.ap.150'],
        ]],
        ['in.ap.40', 'in.ap.140', 'out.ap.10'],
      ], 'result should be correct')
      t.end()
    })
})
