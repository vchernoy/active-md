# Powers and roots

Change the base, including zero and negative numbers. Keep these controls outside the conditions so they always remain accessible.

```calc
input x = 2 in -10..10
input useExtra = 0 in 0..1
input extra = 3 in 0..20
root = if(x >= 0, sqrt(x), 0)
reciprocal = if(x != 0, 1/x, 0)
total = x ^ 2 + if(useExtra, extra, 0)
```

Base :input[x]. Include an extra amount (0 = no, 1 = yes): :input[useExtra].

::::when[x != 0]
For a nonzero base, the reciprocal is :value[reciprocal]{format=fixed:3}.

$$ \left({{x}}\right)^0 = \frac{ {{x}} }{ {{x}} } = 1 $$

:::tip[Parity]
Is the rounded base even? :value[even(x)] (1 = yes, 0 = no).
:::
::::

:::when[x == 0]
Zero has no reciprocal. The value of $0^0$ depends on context; many combinatorial formulas define it as 1.
:::

:::when[x >= 0]
The real square root is :value[root]{format=fixed:3}.
:::

:::when[x < 0]
A negative base has no real square root. The lazy formula does not evaluate `sqrt(x)` in this case.
:::

:::when[useExtra]
Extra amount: :input[extra].
:::

Squared base plus the opted-in extra: **:value[total]**.

Set the extra amount, switch it off, and turn it on again: the hidden control keeps its value. The formula uses `if(useExtra, extra, 0)` so the hidden amount contributes nothing while switched off. Hiding controls alone never resets or disables global inputs.
