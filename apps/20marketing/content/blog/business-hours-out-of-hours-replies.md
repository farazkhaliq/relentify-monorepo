---
title: "How to Set Up Business Hours and Out-of-Hours Auto-Replies"
slug: "business-hours-out-of-hours-replies"
publishDate: "2026-08-24"
author: "Relentify"
category: "Connect"
excerpt: "Customers contact you around the clock, but your team works set hours. Learn how to configure business hours and auto-replies that keep expectations clear."
image: "/blog/business-hours-out-of-hours-replies.jpg"
imageAlt: "Clock icon with business hours schedule next to an auto-reply message preview"
tags: ["business hours helpdesk", "out of hours auto reply"]
region: "all"
---

Your customers do not operate on your schedule. They have questions at midnight, problems on weekends, and urgent requests during your lunch break. Meanwhile, your support team has defined working hours and deserves time away from the queue.

The tension between customer expectations and team availability is one of the most common challenges in support. Business hours configuration and out-of-hours auto-replies are the tools that bridge this gap. They set clear expectations for customers, protect agents from burnout, and ensure your SLA tracking reflects reality rather than penalising your team for hours they were never supposed to be working.

## Why business hours matter for your helpdesk

### Accurate SLA tracking

If your SLA promises a first response within 4 business hours, the clock should only tick during business hours. A ticket submitted at 5 PM on a Friday should not breach its SLA by Saturday morning. Without business hours configured, your helpdesk treats every hour the same — 3 AM on a Sunday counts the same as 10 AM on a Tuesday.

This distorts your metrics and makes SLA reporting unreliable. Agents appear to be missing targets when in reality, the ticket arrived outside working hours.

### Fair agent workload

When business hours are defined, your helpdesk can calculate agent workload accurately. Tickets that arrive overnight are not counted against the morning agent's response time from the moment they were created — they start the clock when the working day begins.

### Customer clarity

Customers who know your hours are available can plan accordingly. Those who contact you outside hours receive an immediate acknowledgement and a clear timeline for when they will hear back. This is far better than silence.

## Configuring business hours

### Define your schedules

Start by documenting your team's actual working pattern:

- **Standard hours** — Monday to Friday, 9 AM to 6 PM (or whatever applies to your team)
- **Extended hours** — If you offer weekend support, define those hours separately
- **Holiday schedule** — Public holidays and company closures when your team is not available
- **Regional variations** — If you have teams in multiple time zones, each may have different hours

Most helpdesks allow you to create named schedules (like "Standard UK Hours" or "US West Coast Hours") and assign them to different teams, channels, or customer tiers.

### Assign schedules to the right entities

Business hours can typically be applied at several levels:

- **Global default** — Applies to all tickets unless overridden
- **Per team** — Different teams may work different hours
- **Per channel** — You might offer extended hours on live chat but standard hours on email
- **Per customer tier** — Enterprise customers might receive 24/7 support while free-tier customers get business hours only

The most common setup is a global default with overrides for specific teams or customer tiers.

### Handle time zones

If your customers span multiple time zones, decide how to handle this:

**Option 1: Your time zone.** All SLAs are calculated based on your team's local time. Simple to configure, but customers in distant time zones may experience longer waits.

**Option 2: Customer's time zone.** SLAs are calculated based on the customer's local time. More customer-friendly, but complex to configure and report on.

**Option 3: Follow-the-sun.** Multiple teams in different time zones provide coverage across a wider window. Tickets are routed to whichever team is currently on shift.

For most small to mid-sized teams, Option 1 with clear communication about your hours is the practical choice.

## Setting up out-of-hours auto-replies

When a customer contacts you outside business hours, silence is the worst possible response. An auto-reply fills the gap with an immediate acknowledgement and clear expectations.

### What a good out-of-hours reply includes

**Acknowledgement.** Let the customer know their message was received. "Thank you for reaching out" is simple but effective.

**Timeline.** Tell them when they can expect a response. "Our team is available Monday to Friday, 9 AM to 6 PM GMT. We will respond to your message when we return."

**Self-service options.** Point them to resources they can use in the meantime. "In the meantime, you might find an answer in our help centre at [link]."

**Urgency path.** If you have an emergency contact method or an on-call process, mention it. "If this is urgent, please call our emergency line at [number]."

**Keep it brief.** Two to four sentences is enough. Do not write a novel.

### Example auto-replies

**Simple and professional:**

> Thanks for your message. Our support team is available Monday to Friday, 9 AM to 6 PM GMT, and we will get back to you as soon as we are online. In the meantime, our help centre at [link] may have the answer you need.

**With urgency path:**

> We have received your message. Our team is currently offline and will respond during our next business day (Monday to Friday, 9 AM to 6 PM). If this is an emergency, please contact our on-call team at [phone number].

**Weekend-specific:**

> Thanks for reaching out over the weekend. Our team will be back on Monday at 9 AM and will respond to your message first thing. If you need immediate help, check out our help articles at [link].

### Channel-specific auto-replies

Different channels may warrant different auto-reply styles:

- **Email** — Can be slightly longer and more detailed, since customers expect email to be asynchronous
- **Live chat** — Should be very short and direct, since the customer is actively waiting on the screen
- **Social messaging** — Conversational and brief, matching the platform's tone
- **Phone** — An automated voicemail greeting with business hours and callback expectations

## Holiday and special event configuration

### Public holidays

Add your regional public holidays to your business hours schedule at the start of each year. Most helpdesks allow you to block out specific dates as non-working days. Tickets received during holidays follow the same out-of-hours rules as weekends.

### Planned closures

If your company closes for an extended period (year-end shutdown, company retreat), update your auto-replies in advance to reflect the specific dates. Generic "we are currently closed" messages are less helpful than "we are closed from December 23 to January 2 and will respond to all messages on January 3."

### Emergency coverage

Define what happens when a genuinely urgent issue arrives outside business hours. Options include:

- **On-call rotation** — A designated team member monitors a separate urgent-only channel
- **Automated escalation** — The helpdesk sends an alert to the on-call person when a ticket matching urgent criteria arrives
- **Third-party coverage** — An outsourced team handles critical issues during your off hours

Not every business needs emergency coverage, but those that do should plan it deliberately rather than relying on agents informally checking messages on their own time.

## How business hours affect your metrics

Once business hours are configured, your metrics change — and they become more accurate.

**First response time** now reflects only the hours your team was available. A ticket created at 11 PM that gets a response at 9:15 AM shows a 15-minute response time, not a 10-hour response time.

**Resolution time** is similarly adjusted. The clock pauses overnight and on weekends.

**SLA compliance** becomes meaningful. Targets are achievable because they are measured against working hours, not calendar hours.

**Agent utilisation** reflects actual working time, giving managers a realistic picture of capacity and workload.

Platforms like [Relentify Connect](/connect) support multiple business hour schedules with holiday calendars, per-team overrides, and SLA calculations that automatically account for your defined working hours.

## Common mistakes

### Not updating holiday schedules

If you set up your holiday calendar once and never update it, your auto-replies will be wrong and your SLA calculations will be inaccurate every year. Make it a recurring task to update the calendar each January.

### Setting unrealistic hours

Configuring business hours as 8 AM to 8 PM but only having staff until 6 PM means tickets arriving between 6 PM and 8 PM will count against your SLA but nobody is there to handle them. Your configured hours should match your actual staffing.

### Ignoring channel differences

If you offer live chat support only during core hours but email support during extended hours, configure separate schedules for each channel. Applying a single schedule to everything creates mismatches.

### Forgetting to test auto-replies

After setting up auto-replies, test them by sending a message to your own support channels outside business hours. Verify that the reply arrives promptly, reads well, and contains accurate information.

## The customer experience perspective

From the customer's point of view, an immediate auto-reply that says "we will get back to you tomorrow at 9 AM" is vastly better than no reply at all. It eliminates uncertainty, prevents the customer from sending duplicate messages, and starts the interaction on a positive note even though no agent is available.

Business hours and auto-replies are not just operational configurations — they are customer experience tools. They communicate that your business is professional, organised, and respectful of both your customers' time and your team's wellbeing.
