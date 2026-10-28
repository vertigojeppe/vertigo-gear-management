import { redirect } from "next/navigation";

/** Contacts moved out of Settings into their own section. */
export default function OldContactsPage() {
  redirect("/contacts");
}
