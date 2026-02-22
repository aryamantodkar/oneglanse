import { createClient } from "@clickhouse/client";
import { clickhouseConfig } from "../config/clickhouse.js";

export const clickhouse = createClient(clickhouseConfig);
