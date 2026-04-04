---
title: "How to Use Macros and Canned Responses to Speed Up Support"
slug: "macros-canned-responses-speed-support"
publishDate: "2026-06-04"
author: "Relentify"
category: "Connect"
excerpt: "Macros and canned responses let agents handle repetitive questions in seconds. Learn how to build a library that saves time without sacrificing quality."
image: "/blog/macros-canned-responses-speed-support.jpg"
imageAlt: "Support agent selecting a pre-written response template from a helpdesk interface"
tags: ["support macros", "canned responses helpdesk"]
region: "all"
---

Every support team has a collection of questions that come up again and again. How do I reset my password? What are your business hours? Can I get a refund? How do I update my billing details?

These questions are not complex. The answers are well known. Yet without a system in place, agents type out the same responses dozens of times a day, wording them slightly differently each time. The result is wasted time, inconsistent messaging, and agents who spend their mental energy on routine tasks instead of the problems that actually require thought.

Macros and canned responses solve this by giving agents a library of pre-written replies they can insert with a click or a keyboard shortcut. Done well, they dramatically reduce response times without making your support feel robotic.

## What macros and canned responses are

The terms are sometimes used interchangeably, but there is a useful distinction.

**Canned responses** are pre-written text snippets that agents can insert into a reply. They fill in the body of a message but do not change anything else about the ticket. Think of them as templates for the message itself.

**Macros** are broader. A macro can insert a canned response, but it can also perform actions on the ticket at the same time. A single macro might insert a reply, set the ticket status to "pending," change the priority to low, and add a tag — all in one click.

In practice, most modern helpdesks combine both concepts into a single feature. When someone says "macros," they usually mean a saved action that can include text, status changes, tag additions, and field updates.

## Why they matter for team performance

The productivity gains from a well-built macro library are significant and measurable.

### Time savings

If an agent handles 40 tickets per day and 15 of them can be partially or fully answered with a macro, the time saved adds up quickly. Even if each macro saves just two minutes of typing, that is 30 minutes per agent per day — or roughly 10 hours per month per agent.

### Consistency

When every agent writes their own version of the refund policy explanation, customers get different information depending on who they reach. Macros ensure the same question always gets the same accurate answer, regardless of which agent handles it.

### Faster onboarding

New agents can start handling common queries almost immediately if they have access to a curated macro library. Instead of memorising policies and processes, they can learn on the job by using macros as a reference while they build expertise.

### Reduced errors

Typed replies introduce typos, forgotten steps, and incomplete information. A well-crafted macro has been reviewed and approved, so the risk of sending incorrect information drops significantly.

## Building your macro library

A macro library is only as useful as its organisation. A disorganised collection of 200 macros that no one can find is barely better than having none at all.

### Start with your most common tickets

Pull a report of your most frequent ticket categories over the last 30 to 90 days. Identify the top 20 topics. These are your starting point. Write macros for each one.

For most support teams, the top 20 categories will cover 60 to 80 percent of total ticket volume. That means a relatively small library can have an outsized impact.

### Use categories and folders

Organise macros into logical groups: billing, account management, technical issues, shipping, returns, onboarding, and so on. Agents should be able to find the right macro in seconds, either by browsing categories or by typing a search keyword.

### Include placeholders for personalisation

A macro should never read like a form letter. Include placeholder variables that pull in the customer's name, their account details, or the specific product they are asking about. Most helpdesks support dynamic variables like `{{customer.first_name}}` or `{{ticket.subject}}`.

A macro that starts with "Hi {{customer.first_name}}" and references their specific issue feels personal, even though the bulk of the text is pre-written.

### Write for humans, not robots

The tone of your macros should match the tone of your brand. If your team communicates in a friendly, conversational style, your macros should reflect that. Avoid overly formal language unless your industry demands it.

Read each macro aloud before saving it. If it sounds like it was written by a committee or a legal department, rewrite it.

### Make macros actionable

The best macros do not just answer a question — they guide the customer toward the next step. Instead of "Your refund has been processed," try "Your refund has been processed and should appear in your account within 3 to 5 business days. If you do not see it after that, reply to this message and we will investigate."

Every macro should leave the customer knowing exactly what happens next.

## Macro best practices

### Keep them short

Macros should be concise. Customers do not want to read a five-paragraph essay in response to a simple question. Aim for three to five sentences for straightforward queries, and no more than two or three short paragraphs for more complex topics.

### Review and update regularly

Products change. Policies change. Pricing changes. A macro that was accurate six months ago might be misleading today. Schedule a quarterly review of your macro library and assign ownership so someone is accountable for keeping them current.

### Track usage

Most helpdesks show which macros are used most frequently and which are never touched. Use this data to refine your library. High-usage macros deserve extra attention to ensure they are polished. Unused macros should be reviewed — either they are hard to find, they address an issue that no longer occurs, or they need better naming.

### Allow agents to customise before sending

A macro should be a starting point, not a straitjacket. Agents should always have the ability to edit the text before sending. Sometimes a customer's situation has a nuance that the standard response does not address. Giving agents the freedom to adjust ensures the response is helpful, not just fast.

### Create macros for internal actions too

Macros are not just for customer-facing replies. You can create macros that handle internal workflows: escalating to a specialist, moving a ticket to a different queue, adding internal notes with investigation steps, or flagging a ticket for follow-up.

## Examples of effective macros

### Password reset

> Hi {{customer.first_name}},
>
> You can reset your password by clicking "Forgot password" on the login page. We will send a reset link to the email address on your account.
>
> If you do not receive the email within a few minutes, check your spam folder. If it is still not there, let us know and we will help you get back in.

**Macro actions:** Set status to "pending," add tag "password-reset."

### Refund confirmation

> Hi {{customer.first_name}},
>
> Your refund of {{amount}} has been processed. It should appear in your account within 3 to 5 business days, depending on your bank.
>
> If you have any other questions, just reply to this message.

**Macro actions:** Set status to "solved," add tag "refund-processed."

### Feature request acknowledgement

> Hi {{customer.first_name}},
>
> Thank you for the suggestion. I have logged this as a feature request with our product team. While I cannot guarantee a timeline, your feedback directly influences what we build next.
>
> We will let you know if this makes it into a future release.

**Macro actions:** Set status to "solved," add tag "feature-request," assign to product feedback group.

## Advanced macro techniques

### Conditional macros

Some platforms allow macros to behave differently based on ticket properties. For example, a billing macro might include different text depending on whether the customer is on a free plan or a paid plan. This reduces the need for multiple similar macros and keeps the library lean.

### Multi-step macros

A macro can trigger a sequence of actions. For instance, a "close and survey" macro might insert a closing message, set the ticket to solved, and trigger a customer satisfaction survey — all from a single click.

### Shared vs personal macros

Most helpdesks distinguish between shared macros (available to the whole team) and personal macros (created by individual agents for their own use). Allow agents to create personal macros for their common workflows, but maintain a curated shared library as the primary resource.

Platforms like [Relentify Connect](/connect) support both shared and personal macro libraries, along with dynamic placeholders and multi-action macros that combine text responses with ticket field updates.

## Measuring the impact

After implementing macros, track these metrics to measure their effect:

- **Average handle time** — This should decrease as agents spend less time composing responses
- **First response time** — Should improve as common queries are answered faster
- **Consistency scores** — If you run quality assurance reviews, check whether response quality becomes more uniform
- **Agent satisfaction** — Agents generally prefer spending time on interesting problems rather than typing the same answer repeatedly

## The balance between speed and empathy

The most common concern about macros is that they make support feel impersonal. This is a valid concern, but it is a problem of execution, not concept.

A well-designed macro with personalisation variables, a human tone, and room for agent customisation feels no different from a personally typed response to the customer. The agent saves time, but the customer experience is unchanged — or even improved, because the response is more accurate and arrives faster.

The key is to treat macros as a tool that frees agents to focus their energy where it matters most: on the complex, emotionally charged, or unusual situations that require genuine human judgment. The routine questions get handled efficiently, and the difficult ones get the attention they deserve.
