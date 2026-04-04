---
title: "The Complete Guide to Ticket Tags, Custom Fields, and Views"
slug: "ticket-tags-custom-fields-views"
publishDate: "2026-06-13"
author: "Relentify"
category: "Connect"
excerpt: "Tags, custom fields, and views turn a chaotic ticket queue into an organised system. Here is how to structure them for maximum clarity and efficiency."
image: "/blog/ticket-tags-custom-fields-views.jpg"
imageAlt: "Helpdesk interface showing colour-coded ticket tags and filtered views"
tags: ["ticket tags helpdesk", "custom fields support tickets"]
region: "all"
---

A helpdesk with a hundred open tickets and no way to organise them is just a fancy inbox. The power of a ticketing system comes from its ability to classify, filter, and surface the right information at the right time. Tags, custom fields, and views are the three tools that make this possible.

Used well, they transform a flat list of tickets into a structured system where agents can instantly find what they need, managers can spot trends, and automations can route work intelligently. Used poorly, they create a tangled mess of overlapping labels that no one understands.

This guide covers how to design and maintain all three so they actually help rather than hinder your support operation.

## Tags: flexible labels for anything

Tags are the simplest organisational tool in a helpdesk. They are freeform labels you attach to tickets to mark them with additional context that the standard fields do not cover.

### What tags are good for

Tags excel at capturing ad hoc or cross-cutting information. They are useful when:

- **Tracking trends** — If you notice a spike in complaints about a specific feature, you can tag those tickets to quantify the trend later
- **Flagging for follow-up** — Tags like "needs-manager-review" or "product-feedback" help route tickets to the right people without changing the formal workflow
- **Categorising by topic** — Tags like "billing," "onboarding," "bug-report," or "integration" help you analyse what customers are contacting you about
- **Supporting automations** — Many automation rules use tags as triggers. A tag of "vip-customer" might route the ticket to a senior agent automatically

### Common mistakes with tags

The biggest problem with tags is proliferation. Because they are freeform, teams end up with dozens or hundreds of tags, many of which overlap or are misspelled variations of each other. "Refund," "refunds," "refund-request," and "refund_request" might all exist in the same system, making reporting unreliable.

**To prevent this:**

- **Establish a naming convention** — Use lowercase, hyphen-separated tags. Decide on singular vs plural and stick with it
- **Maintain a tag dictionary** — Document every approved tag with its definition and when to use it
- **Restrict tag creation** — If your helpdesk allows it, limit who can create new tags. Agents should be able to apply existing tags but may need approval to create new ones
- **Audit regularly** — Review your tag list quarterly. Merge duplicates, retire unused tags, and update the dictionary

### Tag architecture patterns

A useful pattern is to use tag prefixes to create informal categories:

- `product-accounting`, `product-crm`, `product-inventory` — Which product the ticket relates to
- `issue-bug`, `issue-feature-request`, `issue-how-to` — The nature of the request
- `status-waiting-on-vendor`, `status-needs-escalation` — Workflow markers
- `source-social`, `source-phone`, `source-chat` — How the ticket arrived (if not captured automatically)

This prefix approach makes tags self-documenting and easier to search.

## Custom fields: structured data for every ticket

While tags are flexible labels, custom fields are structured data points that you add to your ticket form. They have defined types — dropdown menus, text fields, checkboxes, date pickers — and they capture specific information consistently.

### When to use custom fields instead of tags

The rule of thumb is simple: if the information is consistently needed and has a finite set of possible values, use a custom field. If it is occasional or unpredictable, use a tag.

**Custom field examples:**

- **Product area** (dropdown): Accounting, CRM, Inventory, Timesheets
- **Issue type** (dropdown): Bug, Feature Request, How-To, Billing Query
- **Order number** (text field): Free text for the customer to enter
- **Contract renewal date** (date picker): When the customer's contract expires
- **Affected users** (number): How many users are impacted
- **Environment** (dropdown): Production, Staging, Development

### Designing effective custom fields

**Keep the list short.** Every custom field you add is a field someone has to fill in. If agents need to complete ten custom fields on every ticket, they will rush through them or skip them entirely. Limit required fields to the essentials — typically three to five.

**Use dropdowns over free text wherever possible.** Free text fields are harder to report on because the same information gets entered in different ways. If the answer to a field is one of a known set of options, make it a dropdown.

**Separate customer-facing and agent-facing fields.** Some fields should be filled in by the customer when they submit a ticket (like order number or product area). Others should be filled in by the agent during triage (like priority or issue type). Your helpdesk should let you control which fields appear on the customer form versus the agent interface.

**Make conditional fields.** Not every field is relevant to every ticket. If you have a "product area" dropdown, additional fields specific to that product should only appear when the relevant product is selected. This keeps the form clean and avoids confusion.

### Custom fields and reporting

The real power of custom fields shows up in reporting. Because the data is structured, you can build reports that answer questions like:

- What percentage of tickets are bug reports versus feature requests?
- Which product area generates the most support volume?
- What is the average resolution time for billing queries versus technical issues?
- Are tickets from enterprise customers resolved faster than those from free-tier users?

None of these questions can be reliably answered with tags alone, because tags lack the structure needed for consistent aggregation.

## Views: your window into the queue

Views are saved filters that show agents a subset of tickets based on defined criteria. Instead of looking at every open ticket in the system, an agent can work from a view that shows only the tickets assigned to them, or only the urgent tickets, or only the tickets tagged with a specific product.

### Essential views every team needs

**My open tickets** — Tickets assigned to the current agent that are not yet resolved. This is the default working view for most agents.

**Unassigned tickets** — Open tickets that have not been picked up by anyone. This is the triage queue where new tickets land.

**Urgent and high priority** — All open tickets at P1 or P2 priority, regardless of assignment. This gives managers and senior agents visibility into critical issues.

**Pending customer reply** — Tickets where the team has responded and is waiting for the customer. These should not clutter the main working view.

**Approaching SLA breach** — Tickets that are within a defined percentage of their SLA deadline. This is an early warning system that helps prevent breaches.

**By product area** — Separate views for each product or team, showing only the tickets relevant to that group.

### Building effective views

Views are defined by filter criteria. Common filter parameters include:

- **Status** — Open, pending, on hold, solved, closed
- **Priority** — Urgent, high, normal, low
- **Assignee** — A specific agent, a group, or unassigned
- **Tags** — Any combination of tags
- **Custom fields** — Values from your structured fields
- **Channel** — Email, chat, phone, social
- **Created date** — Tickets from the last 24 hours, last week, etc.
- **SLA status** — Within target, at risk, breached

Most views combine multiple criteria. For example, a view for the billing team might filter on: status is open, product area is "billing," and assignee group is "billing team."

### View hierarchy and access

Not everyone needs to see every view. Structure your views in tiers:

- **Global views** — Available to all agents (unassigned tickets, SLA warnings)
- **Team views** — Available to members of specific groups (billing team queue, technical support queue)
- **Personal views** — Created by individual agents for their own workflow preferences

Allow agents to create personal views, but maintain the global and team views centrally so the team has a consistent foundation.

## Putting it all together

Tags, custom fields, and views work as a system. Custom fields provide the structured data. Tags add flexible context. Views use both to surface the right tickets to the right people.

Here is how they connect in a typical workflow:

1. A customer submits a ticket and fills in custom fields (product area, order number)
2. An automation rule reads the custom fields and applies tags (e.g., if product area is "billing," add the tag "billing")
3. The automation also assigns the ticket to the appropriate group based on the custom field value
4. The ticket appears in the billing team's view because it matches their filter criteria
5. An agent picks up the ticket, adds additional tags during investigation ("refund-processed"), and updates custom fields as needed
6. Managers use views filtered by tags and custom fields to generate reports and spot trends

Platforms like [Relentify Connect](/connect) support this full workflow with custom field types, tag management, and configurable views that update in real time as tickets move through your pipeline.

## Maintenance and governance

An organisational system is only as good as its maintenance. Without regular care, tags multiply, custom fields become outdated, and views stop reflecting how the team actually works.

**Monthly:** Review tag usage reports. Merge or retire tags with fewer than five uses in the last 90 days. Check for near-duplicate tags.

**Quarterly:** Audit custom fields. Are all required fields actually being filled in? Are any fields consistently left blank? Adjust or remove fields that are not adding value.

**When processes change:** Update views to reflect new team structures, product areas, or SLA targets. A view that no longer matches reality is worse than no view at all because it gives a false sense of organisation.

**Document everything:** Maintain a support operations handbook that lists every tag, custom field, and view along with its purpose, owner, and creation date. When someone asks "what does this tag mean?" there should be a clear answer.

## The payoff

Investing time in your ticket organisation system pays dividends in every area of support. Agents find the right tickets faster. Automations route work more accurately. Reports tell a clearer story. And customers get better service because the team behind the scenes is working from a well-organised system rather than a chaotic queue.

The work is not glamorous, but it is foundational. Get your tags, custom fields, and views right, and everything else in your support operation becomes easier.
