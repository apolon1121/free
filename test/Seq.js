const Ɐ = require('jsverify')
const { test } = require('tap')
const { Seq, Identity, equals } = require('./lib')
const lawMonad = require('fantasy-land/laws/monad.js')
const lawApplicative = require('fantasy-land/laws/applicative.js')
const lawFunctor = require('fantasy-land/laws/functor.js')

test('Check laws', (t) => {
  const testLaw = (law, lawTitle, key, args) => {
    t.notThrow(() => {
      Ɐ.assert(Ɐ.forall(Ɐ.any, args.reduce((f, a) => f(a), law[key])))
    }, `${lawTitle}: ${key}`)
  }

  testLaw(lawMonad, 'Monad', 'leftIdentity', [Seq, equals, Seq.of])
  testLaw(lawMonad, 'Monad', 'rightIdentity', [Seq, equals])
  testLaw(lawApplicative, 'Applicative', 'identity', [Seq, equals])
  testLaw(lawApplicative, 'Applicative', 'homomorphism', [Seq, equals])
  testLaw(lawApplicative, 'Applicative', 'interchange', [Seq, equals])
  testLaw(lawFunctor, 'Functor', 'identity', [Seq.of, equals])
  testLaw(lawFunctor, 'Functor', 'composition', [Seq.of, equals, a => [a], a => [a, a]])

  t.end()
})

test('misc', (t) => {
  t.same(
    Seq
      .lift({to: 1})
      .chain((a) => Seq.lift({to: a + 1}))
      .map(a => b => a + b)
      .ap(Seq.of(f => f(1)))
      .foldSeq(a => Identity(a.to * 10), Identity),
    Identity(111)
  )

  t.end()
})

test('toString', (t) => {
  const run = (expected, v) => t.same(v.toString(), expected, expected)

  run('Seq.Pure', Seq.Pure)
  run('Seq.Roll', Seq.Roll)
  run('Seq.Pure(1)', Seq.Pure(1))
  run('Seq.Roll(1, Seq.Pure)', Seq.Roll(1, Seq.Pure))

  t.end()
})
