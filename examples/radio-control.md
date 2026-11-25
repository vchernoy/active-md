# Delivery calculator

This example uses named constants for the input default, range endpoints and radio options, and interpolates each option’s declared value in its label (ActiveMD 0.10.0).

```calc
pickup = 0
standard = 10
express = standard + 15
input delivery = standard in pickup..express
total = 100 + delivery
```

:::radio[Delivery]{input=delivery}
::option[Standard (+{{value}})]{value=standard}
::option[Express (+{{value}})]{value=express}
::option[Pickup (+{{value}})]{value=pickup}
:::

Total: **:value[total]**.

The same binding can also be edited numerically: :edit[Delivery cost]{input=delivery}.
Only the listed values are accepted while this document is mounted.
