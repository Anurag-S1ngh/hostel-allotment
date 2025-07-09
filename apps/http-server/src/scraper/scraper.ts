import axios from "axios";
import * as cheerio from "cheerio";

export async function getLatestCgpi(
  start: string,
  rollNumber: string,
): Promise<number | null> {
  const url = `http://results.nith.ac.in/scheme${start}/studentresult/result.asp`;

  const getRes = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
  });

  const $ = cheerio.load(getRes.data);
  const csrfToken = $("input[name=CSRFToken]").val();
  const requestVerificationToken = $(
    "input[name=RequestVerificationToken]",
  ).val();

  if (!csrfToken || !requestVerificationToken) {
    throw new Error("CSRF tokens not found");
  }

  const formData = new URLSearchParams();
  formData.append("RollNumber", rollNumber);
  formData.append("CSRFToken", String(csrfToken));
  formData.append("RequestVerificationToken", String(requestVerificationToken));
  formData.append("B1", "Submit");

  const postRes = await axios.post<string>(url, formData.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0",
      Referer: url,
    },
  });

  const $$ = cheerio.load(postRes.data);

  const invalidMessage = $$("h2").text().trim();
  if (invalidMessage === "Kindly Check the Roll Number") {
    throw new Error("Roll number does not exist");
  }

  const tables = $$("table");
  if (tables.length < 3) {
    throw new Error("Unexpected HTML structure");
  }

  let latestCgpi: number | null = null;

  for (let i = 3; i < tables.length - 1; i += 2) {
    const summaryTable = tables.eq(i);
    const summaryTds = summaryTable.find("td");
    const cgpiText = summaryTds.eq(3).text().split("=").pop()?.trim() ?? "";
    latestCgpi = parseFloat(cgpiText);
  }

  return latestCgpi;
}
