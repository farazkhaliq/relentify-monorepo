---
title: "How to Use Approval Workflows for Refunds, Returns, and Exceptions"
slug: "approval-workflows-refunds-returns"
publishDate: "2027-01-04"
author: "Relentify"
category: "Connect"
excerpt: "Approval workflows ensure the right people sign off on refunds, returns, and policy exceptions without slowing down the customer experience."
image: "/blog/approval-workflows-refunds-returns.jpg"
imageAlt: "Approval workflow diagram showing a refund request moving through review stages"
tags: ["approval workflows support", "refund approval helpdesk"]
region: "all"
---

A customer asks for a refund. The agent thinks it is reasonable, but they do not have the authority to approve it. So they email their manager. The manager is in meetings all afternoon. The customer waits. By the time the refund is approved the next day, the customer has already written a negative review.

This scenario plays out in support teams everywhere. The need for approval is legitimate — businesses cannot give every agent unlimited authority to issue refunds, accept returns, or make policy exceptions. But the approval process itself often creates delays that damage the customer experience.

Approval workflows solve this by embedding the approval process directly into the helpdesk. When an agent identifies a ticket that needs approval, they trigger a workflow that routes the request to the right person, tracks its status, and moves the ticket forward the moment a decision is made.

## When you need approval workflows

Not every support action needs approval. Approval workflows add value when:

**Financial impact.** Refunds, credits, discounts, and compensation above a certain threshold benefit from a second pair of eyes.

**Policy exceptions.** When a customer's situation does not fit neatly into your standard policy, someone with the authority to make exceptions should review the request.

**Legal or compliance implications.** Responses to legal threats, data deletion requests, or regulatory enquiries should be reviewed before the customer receives a reply.

**High-value accounts.** Actions affecting your largest customers might warrant additional oversight, even if the action itself is within the agent's normal authority.

**Irreversible actions.** Account deletion, data purging, or contract termination should require confirmation from someone beyond the frontline agent.

## How approval workflows work

### The request

The agent identifies that a ticket requires approval and triggers the workflow. This can be done by:

- Selecting an approval option from a dropdown menu
- Applying a specific tag (like "approval-needed")
- Clicking a dedicated approval button in the ticket interface
- Having the workflow trigger automatically based on ticket properties (e.g., refund amount over a threshold)

The agent includes the relevant details: what they are requesting approval for, the amount involved, and their recommendation.

### The routing

The workflow routes the approval request to the appropriate person based on rules you define:

- Refunds under a threshold go to the team lead
- Refunds over a threshold go to the support manager
- Policy exceptions go to the department head
- Legal matters go to the legal team

The routing can also account for availability — if the primary approver is out of office, the request routes to a backup.

### The review

The approver reviews the request within the ticket. They can see the full conversation, the agent's recommendation, and any supporting information. They then approve, deny, or request additional information.

### The resolution

Once approved, the workflow notifies the agent and updates the ticket. The agent proceeds with the approved action (processing the refund, issuing the credit, or communicating the exception to the customer).

If denied, the workflow notifies the agent with the reason, and the agent communicates an alternative resolution to the customer.

### The record

Every step of the approval process is logged in the ticket — who requested, who approved or denied, the reason, and the timestamp. This creates an audit trail that is essential for financial compliance and internal governance.

## Designing your approval workflow

### Define approval thresholds

Set clear financial thresholds that determine when approval is needed and who provides it:

| Action | Threshold | Approver |
|---|---|---|
| Refund | Under $50 | Agent (no approval needed) |
| Refund | $50 to $500 | Team lead |
| Refund | Over $500 | Support manager |
| Policy exception | Any | Team lead |
| Account deletion | Any | Support manager |
| Legal response | Any | Legal team |

These thresholds empower agents to handle routine requests independently while ensuring oversight for higher-stakes decisions.

### Set response time expectations

An approval workflow is only as fast as the approver. Define SLA-like targets for approval decisions:

- Routine approvals (refunds under $500): Decision within 2 hours
- Complex approvals (policy exceptions): Decision within 4 hours
- Urgent approvals (escalated customer, legal matter): Decision within 1 hour

If the approver does not respond within the target, the workflow should escalate to a backup approver.

### Build escalation into the workflow

What happens when the approver is unavailable? The workflow should have a defined escalation path:

1. Route to primary approver
2. If no response in 2 hours, route to secondary approver
3. If no response in 4 hours, route to the department head with an alert

This prevents approval requests from stalling indefinitely because one person is out of office.

### Keep the customer informed

The customer should not experience silence while the approval happens. As soon as the agent triggers the approval workflow, they should update the customer: "I have submitted your request for review by our team. I expect to have an answer for you within [timeframe]."

When the approval comes through, follow up immediately.

### Make the approval request informative

The approver should not need to read the entire ticket to make a decision. The approval request should include:

- A summary of the issue
- The customer's request
- The agent's recommendation
- The financial impact
- Any relevant policy references

A well-structured request leads to faster decisions.

Platforms like [Relentify Connect](/connect) support approval workflows with configurable routing rules, escalation paths, and audit logging that keep approvals moving and fully documented.

## Approval workflows for specific scenarios

### Refund requests

1. Customer requests refund
2. Agent verifies the request against refund policy
3. If within agent authority: agent processes refund directly
4. If above threshold: agent triggers approval workflow with amount and justification
5. Approver reviews and decides
6. Agent processes refund or communicates alternative

### Return authorisations

1. Customer requests return
2. Agent checks return eligibility (timeframe, condition, policy)
3. If eligible under standard policy: agent issues return authorisation
4. If outside standard policy (late return, used product): agent triggers approval
5. Approver reviews and decides
6. Agent communicates decision and provides return instructions if approved

### Policy exceptions

1. Customer's situation does not fit standard policy
2. Agent explains the standard policy to the customer
3. Agent believes an exception is warranted and triggers approval with reasoning
4. Approver reviews the specific circumstances
5. If approved: agent communicates the exception and documents it
6. If denied: agent communicates the standard policy position and any alternatives

### Compensation and goodwill gestures

1. Agent identifies that a goodwill gesture (free month, discount, upgrade) would be appropriate
2. Agent triggers approval with the proposed gesture and reasoning
3. Approver reviews and decides
4. Agent communicates the gesture to the customer

## Measuring approval workflow performance

- **Approval request volume** — How many requests are being submitted? Growing volume might indicate that agent authority thresholds are too low
- **Approval time** — How long does it take from request to decision? This directly impacts customer wait time
- **Approval rate** — What percentage of requests are approved? A very high rate (above 95 percent) might suggest the threshold is too low and agents could handle these decisions themselves
- **Denial rate and reasons** — Understanding why requests are denied helps refine agent training and guidelines
- **Customer impact** — CSAT scores for tickets that went through an approval process versus those that did not

## Common mistakes

**Setting thresholds too low.** If agents need approval for a $10 refund, you are creating unnecessary bottlenecks. Empower agents to handle routine requests independently.

**Not defining backup approvers.** A single point of approval failure (one person on holiday) can stall dozens of tickets.

**Hiding the process from the customer.** Silence during the approval process breeds frustration. Always communicate that a decision is being reviewed and provide a timeline.

**Skipping the audit trail.** Approvals without documentation create risk. Every decision should be logged with the who, what, when, and why.

**Making the request form too complex.** If agents have to fill in ten fields to request a simple refund approval, they will avoid using the workflow. Keep the request format simple and efficient.

## The balance

Approval workflows exist to balance two competing needs: protecting the business from unauthorised or inappropriate actions, and serving the customer with speed and decisiveness.

The best approval processes are invisible to the customer. They experience a brief, communicated pause while the team confirms the right course of action. Then the resolution arrives — correct, authorised, and documented.

The worst approval processes create visible friction. The customer waits, asks for updates, receives vague responses, and eventually gets a decision that took far longer than it should have.

The difference is not whether you require approvals — it is how efficiently your workflow moves them through the system.
