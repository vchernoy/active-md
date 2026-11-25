# Delivery calculator

This example uses named constants for the input default, range endpoints and radio options (ActiveMD 0.9.0).

```calc
pickup = 0
standard = 10
express = standard + 15
input delivery = standard in pickup..express
total = 100 + delivery
```

:::radio[Delivery]{input=delivery}
::option[Standard]{value=standard}
::option[Express]{value=express}
::option[Pickup]{value=pickup}
:::

Total: **:value[total]**.

The same binding can also be edited numerically: :edit[Delivery cost]{input=delivery}.
Only the listed values are accepted while this document is mounted.
