const Ɐ = require('jsverify')
const { test } = require('tap')
const { Par, Identity, equals, lift3 } = require('./lib')
const lawApplicative = require('fantasy-land/laws/applicative.js')
const lawFunctor = require('fantasy-land/laws/functor.js')

test('Check laws', (t) => {
  const testLaw = (law, lawTitle, key, args) => {
    t.notThrow(() => {
      Ɐ.assert(Ɐ.forall(Ɐ.any, args.reduce((f, a) => f(a), law[key])))
    }, `${lawTitle}: ${key}`)
  }

  testLaw(lawApplicative, 'Applicative', 'identity', [Par, equals])
  testLaw(lawApplicative, 'Applicative', 'homomorphism', [Par, equals])
  testLaw(lawApplicative, 'Applicative', 'interchange', [Par, equals])
  testLaw(lawFunctor, 'Functor', 'identity', [Par.of, equals])
  testLaw(lawFunctor, 'Functor', 'composition', [Par.of, equals, a => [a], a => [a, a]])

  t.same(Par.lift({to: 1}).map(a => a + 1).foldPar(a => Identity(a.to * 10), Identity), Identity(11))
  t.same(Par.lift({to: 1}).ap(Par.of(a => a + 1)).foldPar(a => Identity(a.to * 10), Identity), Identity(11))
  t.same(Par.lift({to: 1}).ap(Par.lift({to: 1}).map(a => b => a + b)).foldPar(a => Identity(a.to * 10), Identity), Identity(20))

  t.end()
})

test('fold order should be left to right', (t) => {
  const f = a1 => a2 => a3 => '' + a1 + a2 + a3
  const a1 = Par.lift(1)
  const a2 = Par.lift(2)
  const a3 = Par.lift(3)
  const tree = lift3(f, a1, a2, lift3(f, a1, a2, a3))
  let order = []

  t.same(tree.foldPar(i => {
    order.push(i)
    return Identity(i)
  }, Identity), Identity('12123'))
  t.same(order, [1, 2, 1, 2, 3])

  t.end()
})

test('toString', (t) => {
  t.same(Par.Pure.toString(), 'Par.Pure')
  t.same(Par.Pure(1).toString(), 'Par.Pure(1)')
  t.same(Par.Apply.toString(), 'Par.Apply')
  t.same(Par.Apply(1, Par.Pure(a => a)).toString(), 'Par.Apply(1, Par.Pure(a => a))')

  t.end()
})

// TODO check stack safety for deep structures
