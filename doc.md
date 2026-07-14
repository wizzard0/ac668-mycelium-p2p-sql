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
    - select items per writer x range in pages of SYNC_PAGE_SIZE (1000), ordered by seq
    - insert each page into the other copy before reading the next page
    - crash-safe: the target always holds a contiguous per-writer seq prefix, so an
      interrupted sync resumes from max(seq) on the next run — no in-memory cursor
