const { toString, of, map, ap, lift2 } = require('sanctuary-type-classes')
const patch = require('./fl-patch')
const { id, compose, extend, isTag } = require('./utils')

const flip = f => b => a => f(a)(b)

// data Par f a where
//   Pure :: {a :: a} -> Par f a
//   Apply :: {x :: f a, y :: Par f (a -> b)} -> Par f b

function Pure(a) {
  return extend(Pure$proto, { a })
}

function Apply(x, y) {
  return extend(Apply$proto, { x, y })
}

Pure.toString = () => 'Par.Pure'
Apply.toString = () => 'Par.Apply'

const APPLY = 'Apply'
const PURE = 'Pure'
const PAR = 'Par'

const Par = patch({
  Pure,
  Apply,
  of: Pure,
  lift: (x) => Apply(x, Pure(id)),
  toString: () => 'Par',
})

const Par$proto = patch({
  '@@type': PAR,
  // :: Par f a ~> (f -> g) -> Par g a
  hoistPar(f) {
    return this.foldPar(compose(Par.lift)(f), Par)
  },
  // :: (Applicative f) => Par f a ~> TypeRep f -> f a
  retractPar(m) {
    return this.foldPar(id, m)
  },
  // :: Par f a ~> (f -> Par g a) -> Par g a
  graftPar(f) {
    return this.foldPar(f, Par)
  },
  // :: Par f a ~> Par f (a -> b) -> Par f b
  ap(pf) {
    if (isTag(APPLY, pf)) {
      return Apply(pf.x, lift2(flip, pf.y, this))
    }
    return map(pf.a, this)
  },
  constructor: Par,
})

const Pure$proto = extend(Par$proto, patch({
  tag: PURE,
  toString() {
    return `Par.Pure(${toString(this.a)})`
  },
  // :: Par f a ~> (a -> b) -> Par f b
  map(f) {
    return Par.Pure(f(this.a))
  },
  // :: (Applicative m) => Par f a ~> (f -> m, TypeRep m) -> m a
  foldPar(f, T) {
    return of(T, this.a)
  },
}))

const Apply$proto = extend(Par$proto, patch({
  tag: APPLY,
  toString() {
    return `Par.Apply(${toString(this.x)}, ${toString(this.y)})`
  },
  // :: Par f a ~> (a -> b) -> Par f b
  map(f) {
    return Par.Apply(this.x, map(compose(f), this.y))
  },
  // :: (Applicative m) => Par f a ~> (f -> m, TypeRep m) -> m a
  foldPar(f, T) {
    // interpert instructions first so that fold is left to right
    var fx = f(this.x)
    var ff = this.y.foldPar(f, T)
    return ap(ff, fx)
  },
}))

module.exports = Par
