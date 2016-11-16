const { toString, of, map, ap, lift2 } = require('sanctuary-type-classes')
const daggy = require('daggy')
const patchAll = require('./fl-patch')
const { id, compose } = require('./utils')

// data Par f a where
//   Pure :: a -> Par f a
//   Apply :: f a -> Par f (a -> b) -> Par f b
const Par = daggy.taggedSum({
  Pure: ['a'],
  Apply: ['x', 'y'],
})

Par.toString = () => 'Par'
Par.Pure.toString = () => 'Par.Pure'
Par.Apply.toString = () => 'Par.Apply'
Par.prototype.toString = function() {
  return this.cata({
    Pure: (a) => `Par.Pure(${toString(a)})`,
    Apply: (x, y) => `Par.Apply(${toString(x)}, ${toString(y)})`,
  })
}

Par.prototype.map = function(f) {
  return this.cata({
    Pure: (a) => Par.Pure(f(a)),
    Apply: (x, y) => Par.Apply(x, map(compose(f), y)),
  })
}

Par.of = Par.Pure

const flip = f => b => a => f(a)(b)
Par.prototype.ap = function(pf) {
  return pf.cata({
    Pure: (f) => map(f, this),
    Apply: (x, y) => Par.Apply(x, lift2(flip, y, this)),
  })
}

Par.lift = (x) => Par.Apply(x, Par.Pure(id))

Par.prototype.foldPar = function(f, T) {
  return this.cata({
    Pure: a => of(T, a),
    Apply: (x, y) => {
      // interpert instructions first so that fold is left to right
      var fx = f(x)
      var ff = y.foldPar(f, T)
      return ap(ff, fx)
    },
  })
}

// :: Par f a ~> (f -> g) -> Par g a
Par.prototype.hoistPar = function(f) {
  return this.foldPar(compose(Par.lift)(f), Par)
}

// :: (Applicative f) => Par f a ~> TypeRep f -> f a
Par.prototype.retractPar = function(m) {
  return this.foldPar(id, m)
}

// :: Par f a ~> (f -> Par g a) -> Par g a
Par.prototype.graftPar = function(f) {
  return this.foldPar(f, Par)
}

patchAll([Par, Par.prototype])

module.exports = Par
