# Delivery calculator

Radio controls are available in ActiveMD 0.6.0 and later.

```calc
input delivery = 10 in 0..25
total = 100 + delivery
```

:::radio[Delivery]{input=delivery}
::option[Standard]{value=10}
::option[Express]{value=25}
::option[Pickup]{value=0}
:::

Total: **:value[total]**.

The same binding can also be edited numerically: :edit[Delivery cost]{input=delivery}.
Only the listed values are accepted while this document is mounted.
