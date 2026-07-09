import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchListings from "./tools/search-listings";
import getListing from "./tools/get-listing";
import listMyListings from "./tools/list-my-listings";
import createListing from "./tools/create-listing";
import searchSuppliers from "./tools/search-suppliers";
import getMyProfile from "./tools/get-my-profile";

// OAuth issuer MUST be the direct Supabase host, not the .lovable.cloud proxy.
// Read the project ref from the Vite-inlined env var; process.env.SUPABASE_URL
// is rewritten to the proxy on publish and rejected by mcp-js discovery.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "buildhub-mcp",
  title: "BuildHub",
  version: "0.1.0",
  instructions:
    "Tools for BuildHub, Cambodia's construction marketplace. Search and post construction project listings, browse material and equipment suppliers, and manage your own listings and profile. All write actions run as the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    searchListings,
    getListing,
    listMyListings,
    createListing,
    searchSuppliers,
    getMyProfile,
  ],
});
