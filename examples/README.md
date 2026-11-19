# Examples

Real documents that show what active-md is for. Each one is plain Markdown: open it in the [playground](https://vchernoy.xyz/active-md/) or in TypeBridge (Documents → Format → Markdown) and change the numbers.

| Example | What the reader changes |
|---|---|
| [Compound interest](compound-interest.md) | Deposit, rate and years; the formula is worked through with the reader's numbers |
| [Loan payment](loan-payment.md) | Amount, rate and term; monthly payment, total cost and interest |
| [Pancakes for any number of people](recipe-scaler.md) | Servings; the ingredient table rescales |
| [Split the bill](split-the-bill.md) | Bill, tip and number of people |
| [Running pace](running-pace.md) | Distance and time; pace, speed and a marathon estimate |
| [Dropping a stone](free-fall.md) | Height and gravity: fall time and landing speed |
| [What an appliance costs to run](electricity-cost.md) | Power, hours a day and price per kWh |
| [Powers and roots](powers-and-roots.md) | Zero and negative bases, lazy formulas and retained hidden inputs |
| [Generous container fences](generous-fences.md) | Combined conditions and a callout inside a generous outer fence |
| [Right triangle](right-triangle.md) | The two short sides: hypotenuse, area and perimeter |

Every example is rendered in CI (`packages/remark/test/examples.test.ts`) and must have no errors or warnings.

- [Readable edit and slider controls (unreleased)](readable-controls.md): accessible-only names, inline/standalone controls and legacy compatibility.
- [Delivery select (unreleased)](select-control.md): numeric choices and synchronized controls.
