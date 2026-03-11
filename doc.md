# table synchronizer

- prep
    - assume there's a counterparty which we can exec queries against
    - tables are limited to the per-writer sequences
        - if we need LWW then we group by object id
    - assume there's just a single table rn, it exists and the schemas are fixed
- diag
    - fetch sequences per writer
    - find diff ranges up and down (those are symmetric)
- copy
    - select items per writer x range, assume everything fits (no paging)
    - insert into the other copy
