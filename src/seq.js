const { toString, of, map, chain, chainRec } = require('sanctuary-type-classes')
const patch = require('./fl-patch')
const { id, compose, kcompose, extend, isTag } = require('./utils')

// data Seq f a where
//   Pure :: a -> Seq f a
//   Roll :: f a -> (a -> Seq f b) -> Seq f b
function Pure(a) {
  return extend(Pure$proto, { a })
}

function Roll(x, y) {
  return extend(Roll$proto, { x, y })
}

Pure.toString = () => 'Seq.Pure'
Roll.toString = () => 'Seq.Roll'

const PURE = 'Pure'
const ROLL = 'Roll'
const SEQ = 'Seq'
// const cata = (fs, v) => fs[v.tag](...(isApply(v) ? [v.x, v.y] : [v.a]))

const chainRecNext = (value) => ({ done: false, value })
const chainRecDone = (value) => ({ done: true, value })

const Seq = patch({
  Pure,
  Roll,
  of: Pure,
  lift: (x) => Roll(x, Pure),
  toString: () => 'Seq',
  chainRec: (f, i) => chain(
    ({ done, value }) => done ? of(Seq, value) : chainRec(Seq, f, value),
    f(chainRecNext, chainRecDone, i)
  ),
})

const Seq$proto = patch({
  '@@type': SEQ,
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
  // :: Seq f a ~> Seq f (a -> b) -> Seq f b
  ap(mf) {
    return chain(f => map(f, this), mf)
  },
  // :: (Monad m, ChainRec m) => Seq f a ~> (f -> m, TypeRep m) -> m a
  foldSeq(f, T) {
    return chainRec(T, (next, done, v) => {
      if (isTag(PURE, v)) {
        return map(done, of(T, v.a))
      }
      return map(compose(next)(v.y), f(v.x))
    }, this)
  },
  constructor: Seq,
})

const Pure$proto = extend(Seq$proto, patch({
  tag: PURE,
  toString() {
    return `Seq.Pure(${toString(this.a)})`
  },
  // :: Seq f a ~> (a -> b) -> Seq f b
  map(f) {
    return Seq.Pure(f(this.a))
  },
  // :: Seq f a ~> (a -> Seq f b) -> Seq f b
  chain(f) {
    return f(this.a)
  },
}))

const Roll$proto = extend(Seq$proto, patch({
  tag: ROLL,
  toString() {
    return `Seq.Roll(${toString(this.x)}, ${toString(this.y)})`
  },
  // :: Seq f a ~> (a -> b) -> Seq f b
  map(f) {
    return Seq.Roll(this.x, map(a => map(f, a), this.y))
  },
  // :: Seq f a ~> (a -> Seq f b) -> Seq f b
  chain(f) {
    return Seq.Roll(this.x, kcompose(f)(this.y))
  },
}))

module.exports = Seq
