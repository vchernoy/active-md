# Readable controls

These additive control names require ActiveMD 0.6.0 or later.

```calc
input principal = 100 in 0..10000
input rate = 5 in 0..100
input monthly = 10 in 0..10000
monthlyRate = rate / 1200
growth = (1 + monthlyRate)^12
final = principal * growth + if(rate == 0, monthly * 12, monthly * (growth - 1) / monthlyRate)
```

Start with :edit{input=principal} and add :edit{input=monthly} at the end of every month, at :slider[Annual interest rate]{input=rate step=0.5}% a year.
Interest compounds monthly for one year; contributions arrive at each month’s end. At zero interest, the result is principal plus twelve contributions.
The final amount is **:value[final]{format=fixed:2}**.

You can also place controls on their own line. Brackets name the control for
assistive technology; authors supply visible wording as ordinary prose.

Initial investment:

::edit[Initial investment]{input=principal}

## Legacy compatibility comparison

For existing documents only; use `:edit{input=principal}` in new prose.
The existing spelling still works and stays synchronized: :input[principal].
