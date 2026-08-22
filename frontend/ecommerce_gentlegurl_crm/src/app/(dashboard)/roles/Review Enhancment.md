Please review the query performance for the current Page 

`C:\Users\WS\Desktop\combine\frontend\ecommerce_gentlegurl_crm\src\app\(dashboard)\expenses\page.tsx`
`C:\Users\WS\Desktop\combine\frontend\ecommerce_gentlegurl_crm\src\app\(dashboard)\expense-categories\page.tsx`

The current implementation is stable and already running in production. There are no functional issues, but I've noticed that some queries are slower than expected.

**Please do not change any existing business logic, API behavior, response structure, or user flow.** The goal is purely to identify performance bottlenecks and suggest safe optimizations.

Please investigate:

* Missing database indexes
* Inefficient joins
* N+1 queries
* Unnecessary data fetching
* Slow sorting or filtering
* Opportunities to reduce query execution time

Before making any changes, please:

1. Identify the slow queries.
2. Explain the root cause.
3. Use `EXPLAIN ANALYZE` (or the equivalent execution plan) where applicable.
4. Recommend any indexes or query optimizations, explaining why they help and whether there are any trade-offs (e.g. additional storage or slower writes).

Prioritize safe, low-risk optimizations that will not affect the current production behavior.

