import type { ReportItem } from "../../domain/types";
import { lifeEmails } from "./lifeEmails";

export const report: ReportItem[] = [
  { id: "rp1", areaId: "school", text: "I answered 4 parents' group emails, including that you'll bring gingerbread to the fair on 5 Dec.", emailId: lifeEmails.fair.id },
  { id: "rp2", areaId: "work", text: "The Atlas cutover moved one week, to Mon 7 Dec.", emailId: lifeEmails.cutover.id },
  { id: "rp3", areaId: "jobs", text: "Nordpay sent the take-home case. It's due Tue 1 Dec and on your task list.", emailId: lifeEmails.nordpay.id },
  { id: "rp4", areaId: "jobs", text: "3 new Java, C# and Kotlin roles came in. None beats Fabrikam, so I filed them.", emailId: lifeEmails.jobAlert.id },
  { id: "rp5", areaId: "home", text: "Your winter tire change is confirmed for Tue 24 Nov at 13:00.", emailId: lifeEmails.tires.id },
];
