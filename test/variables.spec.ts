import { expect } from 'chai'
import { $, renderGWValue } from '../src/ast/variables.js'

describe('variables', () => {
  it('renders null', () => {
    expect(null).to.be.null
  })

  it('renders a number', () => {
    expect(renderGWValue(9)).to.equal(9)
  })

  it('renders a string', () => {
    expect(renderGWValue('Good news, everyone!')).to.equal(
      'Good news, everyone!',
    )
  })

  it('renders a list', () => {
    expect(renderGWValue([1, 2, 3])).to.deep.equal([1, 2, 3])
  })

  it('renders an expression', () => {
    expect(renderGWValue($('age + 6 > 18'))).to.equal('${age + 6 > 18}')
  })

  it('renders a complex object', () => {
    const gwvalue = {
      myboolean: true,
      mynestedobject: {
        numbers: [12, 34, 56],
        expression: $('5*(height + 2)'),
      },
      mynull: null,
    }
    expect(renderGWValue(gwvalue)).to.deep.equal({
      myboolean: true,
      mynestedobject: {
        numbers: [12, 34, 56],
        expression: '${5*(height + 2)}',
      },
      mynull: null,
    })
  })
})
