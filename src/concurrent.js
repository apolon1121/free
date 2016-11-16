const { toString, map, chain } = require('sanctuary-type-classes')
const daggy = require('daggy')
const patchAll = require('./fl-patch')
const Par = require('./par')
const Seq = require('./seq')
const { id, compose } = require('./utils')

// data Concurrent f a where
//   Lift :: f a -> Concurrent f a
//   Seq :: Seq (Concurrent f) a -> Concurrent f a
//   Par :: Par (Concurrent f) a -> Concurrent f a
const Concurrent = daggy.taggedSum({
  Lift: ['a'],
  Seq: ['a'],
  Par: ['a'],
})

Concurrent.toString = () => 'Concurrent'
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
  return Concurrent.Seq(map(f, this.seq()))
}

Concurrent.prototype.ap = function(mf) {
  return chain(f => map(f, this), mf)
}

Concurrent.of = a => Concurrent.Seq(Seq.of(a))

Concurrent.prototype.chain = function(f) {
  return Concurrent.Seq(chain(a => f(a).seq(), this.seq()))
}

Concurrent.prototype.fold = function(f, T) {
  return this.cata({
    Lift: a => f(a),
    Par: a => a.foldPar(b => b.fold(f, T), T),
    Seq: a => a.foldSeq(b => b.fold(f, T), T),
  })
}

// data Interpreter f g m = Interpreter
//   { runSeq :: forall x. f x -> m x
//   , runPar :: forall x. f x -> g x
//   , seqToPar :: forall x. m x -> g x
//   , parToSeq :: forall x. g x -> m x
//   , Par :: TypeRep g
//   , Seq :: TypeRep m
//   }

Concurrent.prototype.interpret = function(interpreter) {
  const { runSeq, runPar, seqToPar, parToSeq, Seq, Par } = interpreter
  return this.cata({
    Lift: a => runSeq(a),
    Par: a => a.foldPar(x => x.cata({
      Lift: (b) => runPar(b),
      Par: (b) => x.interpret(interpreter),
      Seq: (b) => seqToPar(x.interpret(interpreter)),
    }), Par),
    Seq: a => a.foldSeq(x => x.cata({
      Lift: (b) => runSeq(b),
      Par: (b) => parToSeq(x.interpret(interpreter)),
      Seq: (b) => x.interpret(interpreter),
    }), Seq),
  })
}

// :: Concurrent f a ~> (f -> g) -> Concurrent g a
Concurrent.prototype.hoist = function(f) {
  return this.fold(compose(Concurrent.lift)(f), Concurrent)
}

// :: (Monad f) => Concurrent f a ~> TypeRep f -> f a
Concurrent.prototype.retract = function(m) {
  return this.fold(id, m)
}

// :: Concurrent f a ~> (f -> Concurrent g a) -> Concurrent g a
Concurrent.prototype.graft = function(f) {
  return this.fold(f, Concurrent)
}

// fromPar :: Par (Concurrent f) a -> Concurrent f a
Concurrent.fromPar = Concurrent.Par

// fromSeq :: Seq (Concurrent f) a -> Concurrent f a
Concurrent.fromSeq = Concurrent.Seq

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

patchAll([Concurrent, Concurrent.prototype])

module.exports = Concurrent
