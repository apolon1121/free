const { toString, of, map, chain, chainRec } = require('sanctuary-type-classes')
const daggy = require('daggy')
const patchAll = require('./fl-patch')
const { id, compose, kcompose } = require('./utils')

// data Seq f a where
//   Pure :: a -> Seq f a
//   Roll :: f a -> (a -> Seq f b) -> Seq f b
const Seq = daggy.taggedSum({
  Pure: ['a'],
  Roll: ['x', 'y'],
})

Seq.toString = () => 'Seq'
Seq.Pure.toString = () => 'Seq.Pure'
Seq.Roll.toString = () => 'Seq.Roll'
Seq.prototype.toString = function() {
  return this.cata({
    Pure: (a) => `Seq.Pure(${toString(a)})`,
    Roll: (x, y) => `Seq.Roll(${toString(x)}, ${toString(y)})`,
  })
}

Seq.prototype.map = function(f) {
  return this.cata({
    Pure: a => Seq.Pure(f(a)),
    Roll: (x, y) => Seq.Roll(x, map(a => map(f, a), y)),
  })
}

Seq.of = Seq.Pure
Seq.prototype.ap = function(mf) {
  return chain(f => map(f, this), mf)
}

Seq.prototype.chain = function(f) {
  return this.cata({
    Pure: a => f(a),
    Roll: (x, y) => Seq.Roll(x, kcompose(f)(y)),
  })
}

Seq.lift = (x) => Seq.Roll(x, Seq.Pure)

Seq.prototype.foldSeq = function(f, T) {
  return chainRec(T, (next, done, v) => v.cata({
    Pure: a => map(done, of(T, a)),
    Roll: (x, y) => map(compose(next)(y), f(x)),
  }), this)
}

const chainRecNext = (value) => ({ done: false, value })
const chainRecDone = (value) => ({ done: true, value })

Seq.chainRec = (f, i) => chain(
  ({ done, value }) => done ? of(Seq, value) : chainRec(Seq, f, value),
  f(chainRecNext, chainRecDone, i)
)

// :: Seq f a ~> (f -> g) -> Seq g a
Seq.prototype.hoistSeq = function(f) {
  return this.foldSeq(compose(Seq.lift)(f), Seq)
}

// :: (Monad m) => Seq m a ~> TypeRep m -> m a
Seq.prototype.retractSeq = function(m) {
  return this.foldSeq(id, m)
}

// :: Seq f a ~> (f -> Seq g a) -> Seq g a
Seq.prototype.graftSeq = function(f) {
  return this.foldSeq(f, Seq)
}

patchAll([Seq, Seq.prototype])

module.exports = Seq
