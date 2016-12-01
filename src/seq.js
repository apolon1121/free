const { of, map, chain, chainRec } = require('sanctuary-type-classes')
const patch = require('./fl-patch')
const { id, compose, kcompose, union } = require('./utils')

// data Seq f a where
//   Pure :: a -> Seq f a
//   Roll :: f a -> (a -> Seq f b) -> Seq f b

const Seq = union('Seq', {
  Pure: ['a'],
  Roll: ['x', 'y'],
})

const { Pure, Roll } = Seq

const chainRecNext = (value) => ({ done: false, value })
const chainRecDone = (value) => ({ done: true, value })

Object.assign(Seq, patch({
  of: Pure,
  lift: (x) => Roll(x, Pure),
  chainRec: (f, i) => chain(
    ({ done, value }) => done ? of(Seq, value) : chainRec(Seq, f, value),
    f(chainRecNext, chainRecDone, i)
  ),
}))

Object.assign(Seq.prototype, patch({
  // :: Seq f a ~> (a -> b) -> Seq f b
  map(f) {
    return this.cata({
      Pure: (a) => Seq.Pure(f(a)),
      Roll: (x, y) => Seq.Roll(x, map(a => map(f, a), y)),
    })
  },
  // :: Seq f a ~> Seq f (a -> b) -> Seq f b
  ap(mf) {
    return chain(f => map(f, this), mf)
  },
  // :: Seq f a ~> (a -> Seq f b) -> Seq f b
  chain(f) {
    return this.cata({
      Pure: (a) => f(a),
      Roll: (x, y) => Seq.Roll(x, kcompose(f)(y)),
    })
  },
  // :: (Monad m, ChainRec m) => Seq f a ~> (f -> m, TypeRep m) -> m a
  foldSeq(f, T) {
    return chainRec(T, (next, done, v) => v.cata({
      Pure: (a) => map(done, of(T, a)),
      Roll: (x, y) => map(compose(next)(y), f(x)),
    }), this)
  },
  // :: Seq f a ~> (f -> g) -> Seq g a
  hoistSeq(f) {
    return this.foldSeq(compose(Seq.lift)(f), Seq)
  },
  // :: (Monad m, ChainRec m) => Seq m a ~> TypeRep m -> m a
  retractSeq(m) {
    return this.foldSeq(id, m)
  },
  // :: Seq f a ~> (f -> Seq g a) -> Seq g a
  graftSeq(f) {
    return this.foldSeq(f, Seq)
  },
}))

module.exports = Seq
