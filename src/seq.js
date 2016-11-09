const { toString, of, map, chain } = require('sanctuary-type-classes')
const daggy = require('daggy')
const patchAll = require('./fl-patch')
const { kcompose } = require('./utils')

// data Seq f a where
//   Pure :: a -> Seq f a
//   Roll :: f a -> (a -> Seq f b) -> Seq f b
const Seq = daggy.taggedSum({
  Pure: ['a'],
  Roll: ['x', 'y'],
})

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
  return this.cata({
    Pure: a => of(T, a),
    Roll: (x, y) => chain(v => y(v).foldSeq(f, T), f(x)),
  })
}

patchAll([Seq, Seq.prototype])

module.exports = Seq
