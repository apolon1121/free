const { toString, map, chain, chainRec } = require('sanctuary-type-classes')
const patch = require('./fl-patch')
const _Par = require('./par')
const _Seq = require('./seq')
const { id, compose, extend, isTag, matchTag } = require('./utils')

// data Concurrent f a where
//   Lift :: f a -> Concurrent f a
//   Seq :: Seq (Concurrent f) a -> Concurrent f a
//   Par :: Par (Concurrent f) a -> Concurrent f a

// data Interpreter f g m = Interpreter
//   { runSeq :: forall x. f x -> m x
//   , runPar :: forall x. f x -> g x
//   , seqToPar :: forall x. m x -> g x
//   , parToSeq :: forall x. g x -> m x
//   , Par :: TypeRep g
//   , Seq :: TypeRep m
//   }

function Lift(a) {
  return extend(Concurrent$proto, { a, tag: LIFT })
}

function Seq(a) {
  return extend(Concurrent$proto, { a, tag: SEQ })
}

function Par(a) {
  return extend(Concurrent$proto, { a, tag: PAR })
}

Lift.toString = () => 'Concurrent.Lift'
Seq.toString = () => 'Concurrent.Seq'
Par.toString = () => 'Concurrent.Par'

const LIFT = 'Lift'
const SEQ = 'Seq'
const PAR = 'Par'
const CONCURRENT = 'Concurrent'

const Concurrent = patch({
  Lift,
  Seq,
  Par,
  of: a => Seq(_Seq.of(a)),
  lift: Lift,
  // fromPar :: Par (Concurrent f) a -> Concurrent f a
  fromPar: Par,
  // fromSeq :: Seq (Concurrent f) a -> Concurrent f a
  fromSeq: Seq,
  toString: () => 'Concurrent',
  chainRec: (f, i) => Seq(
    chainRec(_Seq, (next, done, v) => f(next, done, v).seq(), i)
  ),
})

const Concurrent$proto = patch({
  '@@type': CONCURRENT,
  constructor: Concurrent,
  // :: Concurrent f a ~> String
  toString: function() {
    return matchTag({
      Lift: ({ a }) => `Concurrent.Lift(${toString(a)})`,
      Seq: ({ a }) => `Concurrent.Seq(${toString(a)})`,
      Par: ({ a }) => `Concurrent.Par(${toString(a)})`,
    }, this)
  },
  // :: Concurrent f a ~> (a -> b) -> Concurrent f b
  map(f) {
    return Seq(map(f, this.seq()))
  },
  // :: Concurrent f a ~> Concurrent f (a -> b) -> Concurrent f b
  ap(mf) {
    return chain(f => map(f, this), mf)
  },
  // :: Concurrent f a ~> (a -> Concurrent f b) -> Concurrent f b
  chain(f) {
    return Seq(chain(a => f(a).seq(), this.seq()))
  },
  // :: (Monad m, ChainRec m) => Concurrent f a ~> (f -> m, TypeRep m) -> m a
  fold(f, T) {
    return matchTag({
      Lift: ({ a }) => f(a),
      Par: ({ a }) => a.foldPar(b => b.fold(f, T), T),
      Seq: ({ a }) => a.foldSeq(b => b.fold(f, T), T),
    }, this)
  },
  // :: Concurrent f a -> Seq (Concurrent f) a
  seq() {
    if (isTag(SEQ, this)) {
      return this.a
    }
    return _Seq.lift(this)
  },
  // :: Concurrent f a -> Par (Concurrent f) a
  par() {
    if (isTag(PAR, this)) {
      return this.a
    }
    return _Par.lift(this)
  },
  // (Monad m, ChainRec m, Applicative g) => Concurrent f a ~> Interpreter f g m -> m a
  interpret(interpreter) {
    const { runSeq, runPar, seqToPar, parToSeq, Seq, Par } = interpreter
    return matchTag({
      Lift: ({ a }) => runSeq(a),
      Par: ({ a }) => a.foldPar(x => matchTag({
        Lift: ({ a }) => runPar(a),
        Par: ({ a }) => x.interpret(interpreter),
        Seq: ({ a }) => seqToPar(x.interpret(interpreter)),
      }, x), Par),
      Seq: ({ a }) => a.foldSeq(x => matchTag({
        Lift: ({ a }) => runSeq(a),
        Par: ({ a }) => parToSeq(x.interpret(interpreter)),
        Seq: ({ a }) => x.interpret(interpreter),
      }, x), Seq),
    }, this)
  },
  // :: Concurrent f a ~> (f -> g) -> Concurrent g a
  hoist(f) {
    return this.fold(compose(Concurrent.lift)(f), Concurrent)
  },
  // :: (Monad m, ChainRec m) => Concurrent m a ~> TypeRep m -> m a
  retract(m) {
    return this.fold(id, m)
  },
  // :: Concurrent f a ~> (f -> Concurrent g a) -> Concurrent g a
  graft(f) {
    return this.fold(f, Concurrent)
  },
})

module.exports = Concurrent
