const { chain } = require('sanctuary-type-classes')

//    compose :: (b -> c) -> (a -> b) -> a -> c
const compose = bc => ab => a => bc(ab(a))

//    kcompose :: (Monad m) => b -> m c -> (a -> m b) -> a -> m c
const kcompose = bc => ab => a => chain(bc, ab(a))

//    id :: a -> a
const id = a => a

// creates object using `proto` and then owerrides it with `obj`
const extend = (proto, obj) => Object.assign(Object.create(proto), obj)

//    isTag :: (String, { tag: String | e}) -> Boolean
const isTag = (tag, v) => v.tag === tag

//    isType :: (String, { '@@type': String | e}) -> Boolean
const isType = (type, v) => v['@@type'] === type

const matchTag = (fs, v) => fs[v.tag](v)

module.exports = {
  compose,
  kcompose,
  id,
  extend,
  isTag,
  isType,
  matchTag,
}
