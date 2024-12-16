import { TextEncoder } from "util";
Object.assign(global, { TextEncoder });

import { webcrypto } from "crypto";
Object.assign(global.crypto, { subtle: webcrypto.subtle });

import { sha256 } from "./sha256";
import { arrayBufferToBase64, arrayBufferToHex } from "./arrayBuffer";

test("sha256", async () => {
  const arrayBuffer = await sha256("WCFudVE2H0");

  const byteArray = new Uint8Array(arrayBuffer);

  expect(byteArray).toEqual(
    new Uint8Array([
      208, 160, 29, 229, 184, 189, 196, 250, 128, 7, 83, 207, 77, 121, 94, 55,
      212, 202, 23, 93, 233, 162, 149, 149, 250, 132, 217, 1, 75, 141, 50, 3,
    ]),
  );
});

test("sha256ToHex", async () => {
  const arrayBuffer = await sha256("WCFudVE2H0");

  const hexString = arrayBufferToHex(arrayBuffer);

  expect(hexString).toBe(
    "d0a01de5b8bdc4fa800753cf4d795e37d4ca175de9a29595fa84d9014b8d3203",
  );
});

test("sha256ToBase64", async () => {
  const arrayBuffer = await sha256("WCFudVE2H0");

  const base64String = arrayBufferToBase64(arrayBuffer);

  expect(base64String).toBe("0KAd5bi9xPqAB1PPTXleN9TKF13popWV+oTZAUuNMgM=");
});
