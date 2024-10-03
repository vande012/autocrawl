import { defineFunction } from "@aws-amplify/backend";
    
export const crawler = defineFunction({
  name: "crawler",
  entry: "./handler.ts"
});