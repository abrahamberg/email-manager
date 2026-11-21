import type { EmailRef } from "../../domain/types";

type Draft = Omit<EmailRef, "from"> & { name: string; address: string };

function email({ name, address, ...rest }: Draft): EmailRef {
  return { ...rest, from: { name, address } };
}

const PARENTS_LIST = "foraldrar-3b@solberga.example";

export const lifeEmails = {
  fair: email({
    id: "s1", name: "Karin Ek (3B parents)", address: PARENTS_LIST, areaId: "school", category: "question",
    subject: "Christmas fair: who brings what?", receivedAt: "2026-11-21T07:40:00Z",
    snippet: "Please reply with what you can bring to the fair on 5 Dec.",
  }),
  carpool: email({
    id: "s2", name: "Peter Lund", address: "peter.lund@mail.example", areaId: "school", category: "question",
    subject: "Swimming carpool Thursday", receivedAt: "2026-11-21T08:15:00Z",
    snippet: "Still OK that you drive Thursday and I take next week?",
  }),
  parentsMeeting: email({
    id: "s3", name: "Maria Holm (teacher 3B)", address: "maria.holm@solberga.example", areaId: "school", category: "meeting",
    subject: "Parents' meeting 2 Dec at 18:00: please RSVP", receivedAt: "2026-11-21T09:30:00Z",
    snippet: "We meet in the dining hall. Please let me know if you can come.",
  }),
  allergies: email({
    id: "s4", name: "Karin Ek (3B parents)", address: PARENTS_LIST, areaId: "school", category: "question",
    subject: "Allergy list for the fair", receivedAt: "2026-11-21T10:05:00Z",
    snippet: "To label the food properly, please send any allergies in your family.",
  }),
  classTrip: email({
    id: "s5", name: "Maria Holm (teacher 3B)", address: "maria.holm@solberga.example", areaId: "school", category: "question",
    subject: "Class trip to Skansen 3 Dec: consent and 150 kr", receivedAt: "2026-11-21T11:20:00Z",
    snippet: "Please sign the consent form and pay 150 kr by Friday 27 Nov.",
  }),
  party: email({
    id: "s6", name: "Lina Berg", address: "lina.berg@mail.example", areaId: "school", category: "question",
    subject: "Saga turns 9! Party Sat 28 Nov", receivedAt: "2026-11-20T18:10:00Z",
    snippet: "Elsa is invited to Saga's party at Lekland, Kungsgatan 5, 14:00–16:00.",
  }),
  tires: email({
    id: "c1", name: "Däckcentralen Solna", address: "booking@dackcentralen.example", areaId: "home", category: "receipt",
    subject: "Booking confirmed: tire change Tue 24 Nov 13:00", receivedAt: "2026-11-12T09:02:00Z",
    snippet: "Your winter tire change is booked. Address: Industrivägen 12, Solna.",
  }),
  cutover: email({
    id: "w1", name: "Oskar Nyberg", address: "oskar@northwind.io", areaId: "work", category: "notification",
    subject: "Atlas: cutover moved to 7 Dec", receivedAt: "2026-11-21T10:50:00Z",
    snippet: "We need one more week for the data migration dry run. New cutover: Monday 7 Dec.",
  }),
  jobAlert: email({
    id: "j1", name: "Job alerts", address: "alerts@jobs.example", areaId: "jobs", category: "newsletter",
    subject: "3 new jobs for you: Java, C#, Kotlin", receivedAt: "2026-11-21T06:00:00Z",
    snippet: "Senior Java Developer (remote), C# Backend Engineer (Stockholm), Staff Engineer, Kotlin.",
  }),
  nordpay: email({
    id: "j2", name: "Sara Nilsson (Nordpay)", address: "sara.nilsson@nordpay.example", areaId: "jobs", category: "question",
    subject: "Next step: take-home case by 1 Dec", receivedAt: "2026-11-20T15:30:00Z",
    snippet: "Thanks for the first interview! The next step is a small take-home case in Java or C#, due 1 Dec.",
  }),
  meetup: email({
    id: "i1", name: "Stockholm Kotlin User Group", address: "events@kotlin-sthlm.example", areaId: "jobs", category: "newsletter",
    subject: "Meetup 27 Nov: coroutines in practice", receivedAt: "2026-11-21T05:30:00Z",
    snippet: "Talks on coroutines and a panel on hiring backend developers in 2027.",
  }),
} satisfies Record<string, EmailRef>;
