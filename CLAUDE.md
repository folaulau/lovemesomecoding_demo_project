# Demo projects

## Purpose
- The purpose of this directory is to host demo applications that are used to show case snippets of code in the lovemesomecoding.com tutorials or posts.

## Application
- Each application has a backend and frontend in possibily different languages or frameworks.
- For example the pizza app which is in the pizza directory has pizza-react-frontend for a frontend app in react and pizza-springboot-backend which is a backend written with the Java Springboot framework.


## Standard Workflow

1. **Clarify requirements** — analyse the criteria and ask until they are understood. Flag conflicts
   before building, not after.
2. **Create shared context** — `progress_report.md` in the project folder, tracking progress and
   decisions.
3. **Track solutions and responsibilities** — record the proposed solution and who owns each task.
4. **Frontend first** — build UI with mock data, focusing on styling, layout and interactions.
   Skip if there is no frontend work.
5. **Then backend** — implement the endpoints the frontend needs; coordinate on database changes.
   Use Lombok annotations wherever applicable in Java code.
6. **Integrate** — wire the frontend to the real endpoints and verify.
7. **QA** — run both apps and exercise the UI; validate backend logic by code review.
8. **Iterate** until requirements are met and no bugs remain.
9. **Final delivery check** — demonstrate with Playwright, write tests covering 90% of changes, and
   run `spotless apply` on Java changes. Notify me for review.
10. **Resume work** by reading `progress_report.md` first.
11. **Documentation** — keep all related documents, files and Playwright scripts in the project
    directory.

Note: only these agent types exist here — `claude`, `general-purpose`, `Explore`, `Plan`,
`claude-code-guide`, `statusline-setup`. Do not invoke agents unless I ask for them.

## Git
- Do **not** add `Co-Authored-By` or any author trailer to commits.
- Do **not** push to remote — I do that.
- Never commit log files, `node_modules`, build output, or migration artifacts. Delete stray logs.
- Write a real commit message explaining *why*, not just what.