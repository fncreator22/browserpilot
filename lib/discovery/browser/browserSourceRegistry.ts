/**
 * §CANONICAL BROWSER SOURCE CONNECTOR REGISTRY (TASK-039)
 * 
 * Maps source platform names to their authenticated browser connector implementations.
 */

import { BrowserSourceConnector } from "./browserSourceConnector";
import { linkedInBrowserConnector } from "./connectors/linkedInConnector";
import { indeedBrowserConnector } from "./connectors/indeedConnector";
import {
  greenhouseBrowserConnector,
  ashbyBrowserConnector,
  leverBrowserConnector,
  workableBrowserConnector,
} from "./connectors/atsBrowserConnector";
import { careerPortalBrowserConnector } from "./connectors/careerPortalConnector";

export class BrowserSourceRegistry {
  private connectors: Map<string, BrowserSourceConnector> = new Map();

  constructor() {
    this.registerConnector(linkedInBrowserConnector);
    this.registerConnector(indeedBrowserConnector);
    this.registerConnector(greenhouseBrowserConnector);
    this.registerConnector(ashbyBrowserConnector);
    this.registerConnector(leverBrowserConnector);
    this.registerConnector(workableBrowserConnector);
    this.registerConnector(careerPortalBrowserConnector);
  }

  public registerConnector(connector: BrowserSourceConnector): void {
    this.connectors.set(connector.name.toUpperCase(), connector);
  }

  public getConnector(name: string): BrowserSourceConnector | null {
    return this.connectors.get(name.toUpperCase()) || null;
  }

  public getAllConnectors(): BrowserSourceConnector[] {
    return Array.from(this.connectors.values());
  }
}

export const browserSourceRegistry = new BrowserSourceRegistry();
