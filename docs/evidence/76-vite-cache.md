# Concurrent playground startup (#76)

Main CI44301593782 failed at the Firefox math-scroll test's initial readiness check:
`#source` stayed empty for five seconds. Exact-main Pages44301593663 passed its full
gates; a passing run alone did not establish the cause.

A two-worker local full-suite run reproduced the same startup symptom in Chromium's
mobile-controls test (63 passed, one failed). Its retained trace recorded HTTP504
`Outdated Optimize Dep` responses for rehype/remark/unified modules, alongside Vite
config-change/re-optimization messages. The test never reached its layout assertions.

The playground specs previously created concurrent dev servers with the same default
dependency cache. The shared fixture helper now gives each server a unique temporary
cache directory and removes it after server shutdown. App configuration and the
existing readiness/layout assertions, timeouts and retry count are unchanged.

A regression creates two servers concurrently, checks their caches differ, and verifies
both pages initialize and reload without HTTP/module errors. Full two-worker browser
runs exercise the existing independently configured fixtures together. CI must pass
on the final head before merge; do not close #76 on the strength of a rerun alone.
