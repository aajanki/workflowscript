import { expect } from 'chai'
import { LiteralValueOrLiteralExpression } from '../src/ast/expressions.js'
import { parseExpression } from './testutils.js'

describe('Primitives', () => {
  /*
  it('parses null', () => {
    assertExpression('null', null)
  })
  */

  it('parses a number', () => {
    assertExpression('9', 9)
  })

  it('parses a string', () => {
    assertExpression('"Good news, everyone!"', 'Good news, everyone!')
  })

  it('parses escaped quotes correctly', () => {
    assertExpression(
      '"Tiabeanie \\"Bean\\" Mariabeanie de la Rochambeaux Grunkwitz"',
      'Tiabeanie "Bean" Mariabeanie de la Rochambeaux Grunkwitz',
    )
  })

  it('parses escaped tabs correctly', () => {
    assertExpression('"Bean\\tElfo\\tLuci"', 'Bean\tElfo\tLuci')
  })

  it('parses escaped line feeds', () => {
    assertExpression('"Dagmar\\nOona"', 'Dagmar\nOona')
  })

  it('parses escaped backslashes', () => {
    assertExpression('"Mop Girl\\\\Miri"', 'Mop Girl\\Miri')
  })

  it('parses unicode character references', () => {
    assertExpression('"King Z\\u00f8g"', 'King Zøg')
  })

  it('parses lists', () => {
    assertExpression('[1, 2, 3]', [1, 2, 3])
    assertExpression('["Y", "Yes", 1, True]', ['Y', 'Yes', 1, true])
  })

  it('parses maps', () => {
    assertExpression('{"name": "Merkimer", "race": "pig"}', {
      name: 'Merkimer',
      race: 'pig',
    })
  })
})

describe('Expressions', () => {
  it('parses binary operators', () => {
    assertExpression('0', 0)
    assertExpression('1 + 2', '${1 + 2}')
    assertExpression('5 + 1/3', '${5 + 1 / 3}')
    assertExpression('"Queen" + " Dagmar"', '${"Queen" + " Dagmar"}')
  })

  it('parses unary operators', () => {
    assertExpression('-25', -25)
    assertExpression('-a', '${-a}')
    assertExpression('a - + b', '${a - +b}')
    assertExpression('a * -b', '${a * -b}')
    assertExpression(
      'not (status in ["OK", "success"])',
      '${not (status in ["OK", "success"])}',
    )
    assertExpression(
      '(y >= 0) and not (x >= 0)',
      '${(y >= 0) and not (x >= 0)}',
    )
  })

  it('parses remaider divisions', () => {
    assertExpression('x % 3', '${x % 3}')
    assertExpression('x % t == 0', '${x % t == 0}')
  })

  it('parses variable references', () => {
    assertExpression('a - 1', '${a - 1}')
    assertExpression('100 + 2*x', '${100 + 2 * x}')
    assertExpression('host.ip_address', '${host.ip_address}')
  })

  it('parses subscript references', () => {
    assertExpression('customers[4]', '${customers[4]}')
    assertExpression('customers[99].name', '${customers[99].name}')
    assertExpression('host["ip_address"]', '${host["ip_address"]}')
  })

  it('parses expression as subscript', () => {
    assertExpression('customers[i]', '${customers[i]}')
    assertExpression('customers[2*(a+b)]', '${customers[2 * (a + b)]}')
  })

  it('parses inequality operators', () => {
    assertExpression('value > 100', '${value > 100}')
    assertExpression('status >= 0', '${status >= 0}')
    assertExpression('-1 < 0', '${-1 < 0}')
    assertExpression('x <= 0', '${x <= 0}')
    assertExpression('status != 0', '${status != 0}')
    assertExpression('response != "ERROR"', '${response != "ERROR"}')
    assertExpression('country == "Norway"', '${country == "Norway"}')
  })

  it('parses boolean operators', () => {
    assertExpression(
      'inputOK and receiverReady',
      '${inputOK and receiverReady}',
    )
    assertExpression('isEven or isPositive', '${isEven or isPositive}')
  })

  it('parses membership expressions', () => {
    assertExpression('8 in luckyNumbers', '${8 in luckyNumbers}')
    assertExpression(
      '"Elfo" in ["Luci", "Elfo"]',
      '${"Elfo" in ["Luci", "Elfo"]}',
    )
  })

  it('parses parenthesized expressions', () => {
    assertExpression('(1)', '${(1)}')
    assertExpression('2*(x + 5)', '${2 * (x + 5)}')
    assertExpression('2*(3*(4 + x))', '${2 * (3 * (4 + x))}')
    assertExpression(
      '("Status: " + statusMessage)',
      '${("Status: " + statusMessage)}',
    )
    assertExpression(
      '(age >= 18) and (age < 100)',
      '${(age >= 18) and (age < 100)}',
    )
    assertExpression(
      '(name in ["Bean", "Derek", "Jasper"]) or (affiliation == "Dreamland")',
      '${(name in ["Bean", "Derek", "Jasper"]) or (affiliation == "Dreamland")}',
    )
  })

  it('parses expressions in lists', () => {
    assertExpression('[0, 1+2]', [0, '${1 + 2}'])
    assertExpression('[1+2, 2*(x + 10)]', ['${1 + 2}', '${2 * (x + 10)}'])
  })

  it('parses nested expressions in lists', () => {
    assertExpression('[["first", 1], ["second", 2]]', [
      ['first', 1],
      ['second', 2],
    ])
    assertExpression('[{"name": "Dagmar"}, {"name": "Oona"}]', [
      { name: 'Dagmar' },
      { name: 'Oona' },
    ])
    assertExpression('["Bean" in ["Oona", "Bean"]]', [
      '${"Bean" in ["Oona", "Bean"]}',
    ])
    assertExpression('["Bean" in {"Bean": 1}]', ['${"Bean" in {"Bean": 1}}'])
  })

  it('parses expressions as map values', () => {
    assertExpression('{"name": name}', { name: '${name}' })
    assertExpression('{"age": thisYear - birthYear}', {
      age: '${thisYear - birthYear}',
    })
    assertExpression('{"id": "ID-" + identifiers[2]}', {
      id: '${"ID-" + identifiers[2]}',
    })
  })

  it('parses nested expression in map values', () => {
    assertExpression(
      '{"address": {"building": "The Dreamland Castle", "kingdom": "Dreamland"}}',
      { address: { building: 'The Dreamland Castle', kingdom: 'Dreamland' } },
    )
    assertExpression('{"success": code in [200, 201]}', {
      success: '${code in [200, 201]}',
    })
    assertExpression(
      '{"isKnownLocation": location in {"Dreamland": 1, "Maru": 2}}',
      { isKnownLocation: '${location in {"Dreamland": 1, "Maru": 2}}' },
    )
    assertExpression('{"values": {"next": a + 1}}', {
      values: { next: '${a + 1}' },
    })
  })

  it('parses function expressions', () => {
    assertExpression('default(value, "")', '${default(value, "")}')
    assertExpression('sys.now()', '${sys.now()}')
    assertExpression('time.format(sys.now())', '${time.format(sys.now())}')
    assertExpression(
      'time.format(sys.now()) + " " + text.decode(base64.decode("VGlhYmVhbmll"))',
      '${time.format(sys.now()) + " " + text.decode(base64.decode("VGlhYmVhbmll"))}',
    )
  })
})

function assertExpression(
  expression: string,
  expected: LiteralValueOrLiteralExpression,
): void {
  expect(
    parseExpression(expression).toLiteralValueOrLiteralExpression(),
  ).to.deep.equal(expected)
}