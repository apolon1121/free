const Ɐ = require('jsverify')
const { test } = require('tap')
const { Concurrent, Identity, equals } = require('./lib')
const lawMonad = require('fantasy-land/laws/monad.js')
const lawApplicative = require('fantasy-land/laws/applicative.js')
const lawFunctor = require('fantasy-land/laws/functor.js')

test('Check laws', (t) => {
  const testLaw = (law, lawTitle, key, args) => {
    t.notThrow(() => {
      Ɐ.assert(Ɐ.forall(Ɐ.any, args.reduce((f, a) => f(a), law[key])))
    }, `${lawTitle}: ${key}`)
  }

  testLaw(lawMonad, 'Monad', 'leftIdentity', [Concurrent, equals, Concurrent.of])
  testLaw(lawMonad, 'Monad', 'rightIdentity', [Concurrent, equals])
  testLaw(lawApplicative, 'Applicative', 'identity', [Concurrent, equals])
  testLaw(lawApplicative, 'Applicative', 'homomorphism', [Concurrent, equals])
  testLaw(lawApplicative, 'Applicative', 'interchange', [Concurrent, equals])
  testLaw(lawFunctor, 'Functor', 'identity', [Concurrent.of, equals])
  testLaw(lawFunctor, 'Functor', 'composition', [Concurrent.of, equals, a => [a], a => [a, a]])

  t.end()
})

test('misc', (t) => {
  t.same(
    Concurrent
      .lift({to: 1})
      .chain((a) => Concurrent.lift({to: a + 1}))
      .map(a => b => a + b)
      .ap(Concurrent.of(f => f(1)))
      .foldMap(a => Identity(a.to * 10), Identity),
    Identity(111)
  )

  t.same(
    Concurrent
      .lift({to: 1})
      .chain((a) => Concurrent.lift({to: a + 1}))
      .map(a => a + 1)
      .foldMap(a => Identity(a.to * 10), Identity),
    Identity(111)
  )

  t.same(
    Concurrent
      .lift({to: 1})
      .chain((a) => Concurrent.lift({to: a + 1}))
      .foldMap(a => Identity(a.to * 10), Identity),
    Identity(110)
  )

  t.end()
})

test('toString', (t) => {
  t.same(Concurrent.Lift.toString(), 'Concurrent.Lift')
  t.same(Concurrent.Par.toString(), 'Concurrent.Par')
  t.same(Concurrent.Seq.toString(), 'Concurrent.Seq')
  t.same(Concurrent.Seq(1).toString(), 'Concurrent.Seq(1)')
  t.same(Concurrent.Par(1).toString(), 'Concurrent.Par(1)')
  t.same(Concurrent.Lift(1).toString(), 'Concurrent.Lift(1)')

  t.end()
})
