import type { Area, Fact } from "../../domain/types";
import { emails } from "./emails";
import { lifeEmails } from "./lifeEmails";

export const areas: Area[] = [
  {
    id: "school", shortName: "Elsa's class", kind: "family", name: "Elsa's school, class 3B",
    summary: "The parents' group is organising the Christmas fair on 5 Dec. The class goes to Skansen on 3 Dec and needs your consent and 150 kr by Friday.",
    note: "Elsa has a nut allergy. I drive the swimming carpool on Thursdays in even weeks.",
    people: [
      { name: "Maria Holm", role: "Class teacher" },
      { name: "Karin Ek", role: "Runs the parents' group" },
      { name: "Peter Lund", role: "Swimming carpool" },
    ],
  },
  {
    id: "work", shortName: "Work", kind: "work", name: "Work: Atlas migration",
    summary: "Cutover moved one week to 7 Dec. Mark still owes the pilot API keys. Anna needs the Q4 table before Monday's board pack.",
    people: [
      { name: "Anna Lind", role: "Finance, board pack" },
      { name: "Oskar Nyberg", role: "Project manager" },
      { name: "Mark Jensen", role: "Partner, API access" },
    ],
  },
  {
    id: "jobs", shortName: "Job search", kind: "jobSearch", name: "Job search: staff backend roles",
    summary: "Two processes are moving: Fabrikam wants an intro call, Nordpay sent a take-home case due 1 Dec. Three new matching roles came in today.",
    note: "Looking for staff or senior backend roles, remote or Stockholm. Java, C# or Kotlin. Not interested in crypto.",
    people: [
      { name: "Jonas Berg", role: "Hiring manager, Fabrikam" },
      { name: "Sara Nilsson", role: "Recruiter, Nordpay" },
    ],
  },
  {
    id: "home", shortName: "Car and home", kind: "home", name: "Car, home and health",
    summary: "Winter tires on Tuesday at 13:00. Dentist on Wednesday at 09:30.",
    people: [],
  },
  {
    id: "admin", shortName: "Bills", kind: "admin", name: "Bills and contracts",
    summary: "The Contoso renewal needs a signature by 28 Nov and the price goes up 8%. November's bank statement arrived.",
    people: [],
  },
];

export const facts: Fact[] = [
  { id: "f-tires", areaId: "home", kind: "appointment", title: "Winter tire change", detail: "Booked at Däckcentralen Solna", at: "2026-11-24T12:00:00Z", place: "Industrivägen 12, Solna", sourceEmailId: lifeEmails.tires.id },
  { id: "f-dentist", areaId: "home", kind: "appointment", title: "Dentist", detail: "City Dental, confirmed", at: "2026-11-25T08:30:00Z", place: "Drottninggatan 50, Stockholm", sourceEmailId: emails.dentist.id },
  { id: "f-contract", areaId: "admin", kind: "deadline", title: "Sign Contoso renewal", detail: "Price up 8% (section 4)", at: "2026-11-28T16:00:00Z", sourceEmailId: emails.contract.id },
  { id: "f-trip-pay", areaId: "school", kind: "deadline", title: "Class trip: consent and 150 kr", detail: "Swish to the class account", at: "2026-11-27T16:00:00Z", sourceEmailId: lifeEmails.classTrip.id },
  { id: "f-party", areaId: "school", kind: "appointment", title: "Saga's birthday party (Elsa)", detail: "14:00–16:00, gift budget agreed at 100 kr", at: "2026-11-28T13:00:00Z", place: "Lekland, Kungsgatan 5, Stockholm", sourceEmailId: lifeEmails.party.id },
  { id: "f-nordpay", areaId: "jobs", kind: "deadline", title: "Nordpay take-home case", detail: "Java or C#, about 3 hours", at: "2026-12-01T22:00:00Z", sourceEmailId: lifeEmails.nordpay.id },
  { id: "f-meeting", areaId: "school", kind: "appointment", title: "Parents' meeting 3B", detail: "You said yes", at: "2026-12-02T17:00:00Z", place: "Solberga skola, dining hall", sourceEmailId: lifeEmails.parentsMeeting.id },
  { id: "f-trip", areaId: "school", kind: "appointment", title: "Class trip to Skansen", detail: "Packed lunch, warm clothes", at: "2026-12-03T08:00:00Z", place: "Skansen, Djurgårdsslätten 49", sourceEmailId: lifeEmails.classTrip.id },
  { id: "f-fair", areaId: "school", kind: "appointment", title: "Christmas fair", detail: "You bring gingerbread", at: "2026-12-05T09:00:00Z", place: "Solberga skola", sourceEmailId: lifeEmails.fair.id },
  { id: "f-cutover", areaId: "work", kind: "deadline", title: "Atlas cutover", detail: "Moved from 1 Dec", at: "2026-12-07T07:00:00Z", sourceEmailId: lifeEmails.cutover.id },
  { id: "f-school-address", areaId: "school", kind: "address", title: "Solberga skola", detail: "Elsa's school", place: "Skolvägen 3, Solna", sourceEmailId: lifeEmails.parentsMeeting.id },
];
