import { relations } from "drizzle-orm/relations";
import { companies, prospects, users, contacts, stageTransitions, interactions, rawEvents, tasks, quarantineItems } from "./schema";

export const prospectsRelations = relations(prospects, ({one, many}) => ({
	company: one(companies, {
		fields: [prospects.companyId],
		references: [companies.id]
	}),
	user: one(users, {
		fields: [prospects.ownerId],
		references: [users.id]
	}),
	stageTransitions: many(stageTransitions),
	interactions: many(interactions),
	tasks: many(tasks),
}));

export const companiesRelations = relations(companies, ({many}) => ({
	prospects: many(prospects),
	contacts: many(contacts),
}));

export const usersRelations = relations(users, ({many}) => ({
	prospects: many(prospects),
	stageTransitions: many(stageTransitions),
	tasks: many(tasks),
	quarantineItems: many(quarantineItems),
}));

export const contactsRelations = relations(contacts, ({one, many}) => ({
	company: one(companies, {
		fields: [contacts.companyId],
		references: [companies.id]
	}),
	interactions: many(interactions),
}));

export const stageTransitionsRelations = relations(stageTransitions, ({one}) => ({
	user: one(users, {
		fields: [stageTransitions.actorId],
		references: [users.id]
	}),
	prospect: one(prospects, {
		fields: [stageTransitions.prospectId],
		references: [prospects.id]
	}),
}));

export const interactionsRelations = relations(interactions, ({one}) => ({
	contact: one(contacts, {
		fields: [interactions.contactId],
		references: [contacts.id]
	}),
	prospect: one(prospects, {
		fields: [interactions.prospectId],
		references: [prospects.id]
	}),
	rawEvent: one(rawEvents, {
		fields: [interactions.rawEventId],
		references: [rawEvents.id]
	}),
}));

export const rawEventsRelations = relations(rawEvents, ({many}) => ({
	interactions: many(interactions),
	quarantineItems: many(quarantineItems),
}));

export const tasksRelations = relations(tasks, ({one}) => ({
	user: one(users, {
		fields: [tasks.assigneeId],
		references: [users.id]
	}),
	prospect: one(prospects, {
		fields: [tasks.prospectId],
		references: [prospects.id]
	}),
}));

export const quarantineItemsRelations = relations(quarantineItems, ({one}) => ({
	rawEvent: one(rawEvents, {
		fields: [quarantineItems.rawEventId],
		references: [rawEvents.id]
	}),
	user: one(users, {
		fields: [quarantineItems.resolvedBy],
		references: [users.id]
	}),
}));