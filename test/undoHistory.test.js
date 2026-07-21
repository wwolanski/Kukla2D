import { describe, it, expect, beforeEach } from 'vitest'
import { produceWithPatches } from 'immer'
import { pushPatches, beginBatch, endBatch, isBatching, clearHistory, undo, redo, undoCount, redoCount, applyPatches, transaction, canUndo, canRedo, peekUndo } from '../src/store/undoHistory.js'

beforeEach(() => {
  clearHistory()
})

function makePatches(recipe, base) {
  return produceWithPatches(base, recipe)
}

describe('pushPatches', () => {
  it('records forward and inverse patches', () => {
    const base = { a: 1 }
    const [, fwd, inv] = makePatches((s) => { s.a = 2 }, base)
    pushPatches(fwd, inv)
    expect(undoCount()).toBe(1)
  })

  it('empty patches are ignored', () => {
    pushPatches([], [])
    expect(undoCount()).toBe(0)
  })
})

describe('undo / redo', () => {
  it('undo applies inverse patches', () => {
    const base = { a: 1 }
    const [, fwd, inv] = makePatches((s) => { s.a = 2 }, base)
    pushPatches(fwd, inv)

    let applied
    undo((inversePatches) => {
      applied = applyPatches({ a: 2 }, inversePatches)
    })
    expect(applied).toEqual({ a: 1 })
  })

  it('redo applies forward patches', () => {
    const base = { a: 1 }
    const [, fwd, inv] = makePatches((s) => { s.a = 2 }, base)
    pushPatches(fwd, inv)

    undo(() => {})
    let applied
    redo((forwardPatches) => {
      applied = applyPatches({ a: 1 }, forwardPatches)
    })
    expect(applied).toEqual({ a: 2 })
  })
})

describe('undoCount / redoCount', () => {
  it('returns correct counts after operations', () => {
    expect(undoCount()).toBe(0)
    expect(redoCount()).toBe(0)

    const [, fwd1, inv1] = makePatches((s) => { s.x = 10 }, { x: 0 })
    pushPatches(fwd1, inv1)
    const [, fwd2, inv2] = makePatches((s) => { s.x = 20 }, { x: 10 })
    pushPatches(fwd2, inv2)

    expect(undoCount()).toBe(2)
    expect(redoCount()).toBe(0)

    undo(() => {})
    expect(undoCount()).toBe(1)
    expect(redoCount()).toBe(1)

    redo(() => {})
    expect(undoCount()).toBe(2)
    expect(redoCount()).toBe(0)
  })
})

describe('clearHistory', () => {
  it('resets both stacks and batch depth', () => {
    const [, fwd, inv] = makePatches((s) => { s.x = 1 }, { x: 0 })
    pushPatches(fwd, inv)
    beginBatch({ x: 2 })
    clearHistory()
    expect(undoCount()).toBe(0)
    expect(redoCount()).toBe(0)
    expect(isBatching()).toBe(false)
  })
})

describe('batching', () => {
  it('beginBatch/endBatch with correct nesting', () => {
    expect(isBatching()).toBe(false)
    beginBatch({ a: 1 })
    expect(isBatching()).toBe(true)
    beginBatch({ a: 2 })
    expect(isBatching()).toBe(true)
    endBatch()
    expect(isBatching()).toBe(true)
    endBatch()
    expect(isBatching()).toBe(false)
  })

  it('accumulated patches produce one undo entry', () => {
    beginBatch({ a: 1 })
    const [, fwd1, inv1] = makePatches((s) => { s.a = 2 }, { a: 1 })
    pushPatches(fwd1, inv1)
    const [, fwd2, inv2] = makePatches((s) => { s.a = 3 }, { a: 2 })
    pushPatches(fwd2, inv2)
    endBatch()
    expect(undoCount()).toBe(1)

    let applied
    undo((inversePatches) => {
      applied = applyPatches({ a: 3 }, inversePatches)
    })
    expect(applied).toEqual({ a: 1 })
  })

  it('preserves inverse patch order inside each batched mutation', () => {
    beginBatch({ items: ['a', 'b', 'c'] })
    const [state1, fwd1, inv1] = makePatches((s) => {
      s.items.splice(1, 1)
      s.items.push('d')
    }, { items: ['a', 'b', 'c'] })
    pushPatches(fwd1, inv1)
    const [, fwd2, inv2] = makePatches((s) => {
      s.items.unshift('z')
      s.items[2] = 'x'
    }, state1)
    pushPatches(fwd2, inv2)
    endBatch()

    let applied
    undo((inversePatches) => {
      applied = applyPatches({ items: ['z', 'a', 'x', 'd'] }, inversePatches)
    })
    expect(applied).toEqual({ items: ['a', 'b', 'c'] })
  })

  it('empty batch produces no undo entry', () => {
    beginBatch({ a: 1 })
    endBatch()
    expect(undoCount()).toBe(0)
  })

  it('empty batch preserves redo history', () => {
    const [, fwd, inv] = makePatches((s) => { s.a = 2 }, { a: 1 })
    pushPatches(fwd, inv)
    undo(() => {})
    beginBatch({ a: 1 })
    endBatch()
    expect(redoCount()).toBe(1)
  })
})

describe('MAX_HISTORY limit', () => {
  it('drops oldest after exceeding 50 pushes', () => {
    for (let i = 0; i < 55; i++) {
      const [, fwd, inv] = makePatches((s) => { s.i = i + 1 }, { i: i })
      pushPatches(fwd, inv)
    }
    expect(undoCount()).toBe(50)
    for (let j = 0; j < 50; j++) {
      undo(() => {})
    }
    expect(undoCount()).toBe(0)
  })
})

describe('typed arrays through patches', () => {
  it('full property replacement of Float32Array survives round-trip', () => {
    const base = { verts: new Float32Array([1, 2, 3]) }
    const [, fwd, inv] = makePatches((s) => { s.verts = new Float32Array([99, 2, 3]) }, base)
    pushPatches(fwd, inv)

    let applied
    undo((inversePatches) => {
      applied = applyPatches({ verts: new Float32Array([99, 2, 3]) }, inversePatches)
    })
    expect(applied.verts).toBeInstanceOf(Float32Array)
    expect(Array.from(applied.verts)).toEqual([1, 2, 3])
  })
})

describe('undo and redo round-trip', () => {
  it('undo then redo restores original state', () => {
    const base = { x: 1, y: 2 }
    const [, fwd, inv] = makePatches((s) => { s.x = 10; s.y = 20 }, base)
    pushPatches(fwd, inv)

    let undoResult, redoResult
    undo((inversePatches) => {
      undoResult = applyPatches({ x: 10, y: 20 }, inversePatches)
    })
    expect(undoResult).toEqual({ x: 1, y: 2 })

    redo((forwardPatches) => {
      redoResult = applyPatches({ x: 1, y: 2 }, forwardPatches)
    })
    expect(redoResult).toEqual({ x: 10, y: 20 })
  })
})

describe('multiple sequential edits', () => {
  it('undo reverts in reverse order', () => {
    const states = [{ v: 0 }]
    const [, f1, i1] = makePatches((s) => { s.v = 1 }, states[0])
    pushPatches(f1, i1)
    states.push({ v: 1 })

    const [, f2, i2] = makePatches((s) => { s.v = 2 }, states[1])
    pushPatches(f2, i2)
    states.push({ v: 2 })

    let result
    undo((inv) => { result = applyPatches(states[2], inv) })
    expect(result).toEqual({ v: 1 })

    undo((inv) => { result = applyPatches(states[1], inv) })
    expect(result).toEqual({ v: 0 })
  })
})

describe('pushPatches during batch is accumulated', () => {
  it('patches inside batch are merged into single undo entry', () => {
    beginBatch({ items: [1] })
    const [, f1, i1] = makePatches((s) => { s.items.push(2) }, { items: [1] })
    pushPatches(f1, i1)
    const [, f2, i2] = makePatches((s) => { s.items.push(3) }, { items: [1, 2] })
    pushPatches(f2, i2)
    endBatch()
    expect(undoCount()).toBe(1)
  })
})

describe('nested batches', () => {
  it('nested begin/end only commits at outermost end', () => {
    beginBatch({ val: 0 })
    beginBatch({ val: 0 })
    const [, fwd, inv] = makePatches((s) => { s.val = 5 }, { val: 0 })
    pushPatches(fwd, inv)
    endBatch()
    expect(undoCount()).toBe(0)
    endBatch()
    expect(undoCount()).toBe(1)
  })
})

describe('transaction API', () => {
  it('empty transaction preserves redo history', () => {
    const [, fwd, inv] = makePatches((s) => { s.a = 2 }, { a: 1 })
    pushPatches(fwd, inv)
    undo(() => {})
    transaction('No-op', 'test', () => {})
    expect(redoCount()).toBe(1)
  })

  it('transaction creates named undo entry', () => {
    transaction('move part', 'transform', () => {
      const [, fwd, inv] = makePatches((s) => { s.x = 10 }, { x: 0 })
      pushPatches(fwd, inv)
    })
    expect(undoCount()).toBe(1)
    const entry = peekUndo()
    expect(entry.name).toBe('move part')
    expect(entry.type).toBe('transform')
  })

  it('transaction groups multiple patches into one entry', () => {
    transaction('multi-edit', 'brush', () => {
      const [, f1, i1] = makePatches((s) => { s.a = 1 }, { a: 0 })
      pushPatches(f1, i1)
      const [, f2, i2] = makePatches((s) => { s.a = 2 }, { a: 1 })
      pushPatches(f2, i2)
    })
    expect(undoCount()).toBe(1)
    const entry = peekUndo()
    expect(entry.name).toBe('multi-edit')
    expect(entry.type).toBe('brush')
  })

  it('undo after transaction applies inverse patches correctly', () => {
    transaction('set value', 'transform', () => {
      const [, fwd, inv] = makePatches((s) => { s.val = 42 }, { val: 0 })
      pushPatches(fwd, inv)
    })

    let result
    undo((inversePatches) => {
      result = applyPatches({ val: 42 }, inversePatches)
    })
    expect(result).toEqual({ val: 0 })
  })

  it('transaction clears redo stack', () => {
    const [, fwd, inv] = makePatches((s) => { s.a = 1 }, { a: 0 })
    pushPatches(fwd, inv)
    undo(() => {})
    expect(redoCount()).toBe(1)

    transaction('new edit', 'import', () => {
      const [, f2, i2] = makePatches((s) => { s.b = 2 }, { b: 0 })
      pushPatches(f2, i2)
    })
    expect(redoCount()).toBe(0)
  })
})

describe('canUndo / canRedo', () => {
  it('returns false when stacks are empty', () => {
    expect(canUndo()).toBe(false)
    expect(canRedo()).toBe(false)
  })

  it('returns true after pushing patches', () => {
    const [, fwd, inv] = makePatches((s) => { s.x = 1 }, { x: 0 })
    pushPatches(fwd, inv)
    expect(canUndo()).toBe(true)
    expect(canRedo()).toBe(false)
  })

  it('returns true for redo after undo', () => {
    const [, fwd, inv] = makePatches((s) => { s.x = 1 }, { x: 0 })
    pushPatches(fwd, inv)
    undo(() => {})
    expect(canRedo()).toBe(true)
  })
})

describe('named entries', () => {
  it('pushPatches without transaction has default name/type', () => {
    const [, fwd, inv] = makePatches((s) => { s.x = 1 }, { x: 0 })
    pushPatches(fwd, inv)
    const entry = peekUndo()
    expect(entry.name).toBe('Project edit')
    expect(entry.type).toBe('project')
  })

  it('batch with named meta preserves name/type', () => {
    transaction('import project', 'import', () => {
      const [, fwd, inv] = makePatches((s) => { s.loaded = true }, { loaded: false })
      pushPatches(fwd, inv)
    })
    const entry = peekUndo()
    expect(entry.name).toBe('import project')
    expect(entry.type).toBe('import')
  })

  it('beginBatch without explicit meta still creates a named entry', () => {
    beginBatch({ x: 0 })
    const [, fwd, inv] = makePatches((s) => { s.x = 1 }, { x: 0 })
    pushPatches(fwd, inv)
    endBatch()
    const entry = peekUndo()
    expect(entry.name).toBe('Batch edit')
    expect(entry.type).toBe('batch')
  })
})
