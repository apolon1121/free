const { test } = require('tap')
const { union } = require('./lib')
const List = union('List', {
  Cons: ['x', 'xs'],
  Nil: [],
})
test('misc', (t) => {
  const xs = List.Cons(1, List.Nil)
  t.throws(() => {
    xs.cata({
      Cons: (a, b) => a,
    })
  }, 'throws if all cases are not handled')
  t.same(xs.toString(), 'List.Cons(1, List.Nil())')
  t.end()
})
