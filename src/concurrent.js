const patchAll = require('./fl-patch')
const daggy = require('daggy')
const { toString, of, map, ap, chain, lift2 } = require('sanctuary-type-classes')

// data Par f a where
const Par = daggy.taggedSum({
  // Pure :: a -> Par f a
  Pure: ['a'],
  // Apply :: f a -> Par f (a -> b) -> Par f b
  Apply: ['x', 'y'],
})

Par.Pure.toString = () => 'Par.Pure'

Par.Apply.toString = () => 'Par.Apply'

Par.prototype.toString = function() {
  return this.cata({
    Pure: (a) => `Par.Pure(${toString(a)})`,
    Apply: (x, y) => `Par.Apply(${toString(x)}, ${toString(y)})`,
  })
}

const compose = f => g => a => f(g(a))
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

const id = a => a
Par.lift = (x) => Par.Apply(x, Par.Pure(id))

Par.prototype.foldMap = function(f, T) {
  return this.cata({
    Pure: a => of(T, a),
    Apply: (x, y) => {
      // interpert instructions first so that fold is left to right
      var fx = f(x)
      var ff = y.foldMap(f, T)
      return ap(ff, fx)
    },
  })
}

// data Seq f a where
const Seq = daggy.taggedSum({
  //   Pure :: a -> Seq f a
  Pure: ['a'],
  //   Roll :: f a -> (a -> Seq f b) -> Seq f b
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

const kcompose = (bc, ab) => a => ab(a).chain(bc)
Seq.prototype.chain = function(f) {
  return this.cata({
    Pure: a => f(a),
    Roll: (x, y) => Seq.Roll(x, kcompose(f, y)),
  })
}

Seq.lift = (x) => Seq.Roll(x, Seq.Pure)

Seq.prototype.foldMap = function(f, T) {
  return this.cata({
    Pure: a => of(T, a),
    Roll: (x, y) => chain(map(a => a.foldMap(f, T), y), f(x)),
  })
}

// data Concurrent f a where
const Concurrent = daggy.taggedSum({
  //   Lift :: f a -> Concurrent f a
  Lift: ['a'],
  //   Seq :: Seq (Concurrent f) a -> Concurrent f a
  Seq: ['a'],
  //   Par :: Par (Concurrent f) a -> Concurrent f a
  Par: ['a'],
})

Concurrent.Lift.toString = () => 'Concurrent.Lift'

Concurrent.Par.toString = () => 'Concurrent.Par'

Concurrent.Seq.toString = () => 'Concurrent.Seq'

Concurrent.prototype.toString = function() {
  return this.cata({
    Lift: (a) => `Concurrent.Lift(${toString(a)})`,
    Seq: (a) => `Concurrent.Seq(${toString(a)})`,
    Par: (a) => `Concurrent.Par(${toString(a)})`,
  })
}
Concurrent.lift = Concurrent.Lift

Concurrent.prototype.map = function(f) {
  // return ap(Concurrent.of(f), this)
  return Concurrent.Seq(map(f, this.seq()))
}

Concurrent.prototype.ap = function(mf) {
  return chain(f => map(f, this), mf)
}

Concurrent.of = a => Concurrent.Seq(Seq.of(a))

Concurrent.prototype.chain = function(f) {
  return chain(a => f(a).seq(), this.seq()).up()
}

Concurrent.prototype.foldMap = function(f, T) {
  return this.cata({
    Lift: a => f(a),
    Par: a => a.foldMap(b => b.foldMap(f, T), T),
    Seq: a => a.foldMap(b => b.foldMap(f, T), T),
  })
}

// data Interpreter f g m = Interpreter
//   { runSeq :: forall x. f x -> m x
//   , runPar :: forall x. f x -> g x
//   , seqToPar :: forall x. m x -> g x
//   , parToSeq :: forall x. g x -> m x
//   }

Concurrent.prototype.interpret = function(interpreter) {
  const { runSeq, runPar, seqToPar, parToSeq, Seq, Par } = interpreter
  return this.cata({
    Lift: a => runSeq(a),
    Par: function intRar(a) {
      return a.cata({
        Pure: (x) => Par(x),
        Apply: (x, y) => {
          const fx = x.cata({
            Lift: (b) => runPar(b),
            Par: (b) => x.interpret(interpreter),
            Seq: (b) => seqToPar(x.interpret(interpreter)),
          })
          const ff = intRar(y)
          return ap(ff, fx)
        },
      })
    },
    Seq: a => a.cata({
      Pure: (x) => Seq(x),
      Roll: (x, y) => {
        const my = x.cata({
          Lift: (b) => runSeq(b),
          Par: (b) => parToSeq(x.interpret(interpreter)),
          Seq: (b) => x.interpret(interpreter),
        })
        return chain((v) => y(v).up().interpret(interpreter), my)
      },
    }),
  })
}

// :: Par (Concurrent f) a -> Seq (Concurrent f) a
Par.prototype.seq = function() {
  return Seq.lift(Concurrent.Par(this))
}

// :: Seq (Concurrent f) a -> Par (Concurrent f) a
Seq.prototype.par = function() {
  return Par.lift(Concurrent.Seq(this))
}

// :: Par (Concurrent f) a -> Concurrent f a
Par.prototype.up = function() {
  return Concurrent.Par(this)
}

// :: Seq (Concurrent f) a -> Concurrent f a
Seq.prototype.up = function() {
  return Concurrent.Seq(this)
}

// :: Concurrent f a -> Seq (Concurrent f) a
Concurrent.prototype.seq = function() {
  return this.cata({
    Lift: () => Seq.lift(this),
    Seq: (a) => a,
    Par: () => Seq.lift(this),
  })
}

// :: Concurrent f a -> Par (Concurrent f) a
Concurrent.prototype.par = function() {
  return this.cata({
    Lift: () => Par.lift(this),
    Seq: () => Par.lift(this),
    Par: (a) => a,
  })
}

patchAll([
  Seq, Seq.prototype,
  Par, Par.prototype,
  Concurrent, Concurrent.prototype,
])

module.exports = {
  Seq,
  Par,
  Concurrent,
}
