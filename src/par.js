const { of, map, ap, lift2 } = require('sanctuary-type-classes')
const patch = require('./fl-patch')
const { id, compose, union } = require('./utils')

const flip = f => b => a => f(a)(b)

// data Par f a where
//   Pure  :: a -> Par f a
//   Apply :: f a -> Par f (a -> b) -> Par f b
const Par = union('Par', {
  Pure: ['a'],
  Apply: ['x', 'y'],
})

const { Pure, Apply } = Par

Object.assign(Par, patch({
  // :: a -> Par f a
  of: Pure,
  // :: f a -> Par f a
  lift: (x) => Apply(x, Pure(id)),
}))

Object.assign(Par.prototype, patch({
  // :: Par f a ~> (a -> b) -> Par f b
  map(f) {
    return this.cata({
      Pure: (a) => Par.Pure(f(a)),
      Apply: (x, y) => Par.Apply(x, map(compose(f), y)),
    })
  },
  // :: Par f a ~> Par f (a -> b) -> Par f b
  ap(pf) {
    return pf.cata({
      Pure: (a) => map(pf.a, this),
      Apply: (x, y) => Apply(pf.x, lift2(flip, pf.y, this)),
    })
  },
  // :: (Applicative g) => Par f a ~> (Ɐ x. f x -> g x, TypeRep g) -> g a
  foldPar(f, T) {
    return this.cata({
      Pure: (a) => of(T, a),
      Apply: (x, y) => {
        // interpert instructions first so that fold is left to right
        var fx = f(x)
        var ff = y.foldPar(f, T)
        return ap(ff, fx)
      },
    })
  },
  // :: Par f a ~> (Ɐ x. f x -> g x) -> Par g a
  hoistPar(f) {
    return this.foldPar(compose(Par.lift)(f), Par)
  },
  // :: (Applicative f) => Par f a ~> TypeRep f -> f a
  retractPar(m) {
    return this.foldPar(id, m)
  },
  // :: Par f a ~> (Ɐ x. f x -> Par g x) -> Par g a
  graftPar(f) {
    return this.foldPar(f, Par)
  },
}))

module.exports = Par
