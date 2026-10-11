import { describe, expect, it, spyOn } from "bun:test";

import { EventDispatcher } from "./events.js";

type TestEventMap = {
  change: { value: number };
};

describe("EventDispatcher", () => {
  it("replaces the singular handler", () => {
    const dispatcher = new EventDispatcher<TestEventMap>();
    const calls: string[] = [];
    const first = () => calls.push("first");
    const second = () => calls.push("second");
    const warn = spyOn(console, "warn").mockImplementation(() => {});

    try {
      dispatcher.setHandler("change", first);
      dispatcher.setHandler("change", second);

      expect(dispatcher.getHandler("change")).toBe(second);
      dispatcher.dispatch("change", { value: 1 });
      expect(calls).toEqual(["second"]);
    } finally {
      warn.mockRestore();
    }
  });

  it("dispatches the singular handler before listeners in insertion order", () => {
    const dispatcher = new EventDispatcher<TestEventMap>();
    const calls: string[] = [];

    dispatcher.setHandler("change", () => calls.push("handler"));
    dispatcher.addEventListener("change", () => calls.push("listener-1"));
    dispatcher.addEventListener("change", () => calls.push("listener-2"));

    dispatcher.dispatch("change", { value: 1 });

    expect(calls).toEqual(["handler", "listener-1", "listener-2"]);
  });

  it("uses a listener snapshot when a listener is removed during dispatch", () => {
    const dispatcher = new EventDispatcher<TestEventMap>();
    const calls: string[] = [];
    const second = () => calls.push("second");
    const first = () => {
      calls.push("first");
      dispatcher.removeEventListener("change", second);
    };

    dispatcher.addEventListener("change", first);
    dispatcher.addEventListener("change", second);

    dispatcher.dispatch("change", { value: 1 });
    dispatcher.dispatch("change", { value: 2 });

    expect(calls).toEqual(["first", "second", "first"]);
  });

  it("defers listeners added by the singular handler until the next dispatch", () => {
    const dispatcher = new EventDispatcher<TestEventMap>();
    const calls: string[] = [];
    const listener = () => calls.push("listener");

    dispatcher.setHandler("change", () => {
      calls.push("handler");
      dispatcher.addEventListener("change", listener);
      dispatcher.setHandler("change", undefined);
    });

    dispatcher.dispatch("change", { value: 1 });
    expect(calls).toEqual(["handler"]);

    dispatcher.dispatch("change", { value: 2 });
    expect(calls).toEqual(["handler", "listener"]);
  });

  it("keeps listeners removed by the singular handler in the current dispatch", () => {
    const dispatcher = new EventDispatcher<TestEventMap>();
    const calls: string[] = [];
    const listener = () => calls.push("listener");

    dispatcher.addEventListener("change", listener);
    dispatcher.setHandler("change", () => {
      calls.push("handler");
      dispatcher.removeEventListener("change", listener);
    });

    dispatcher.dispatch("change", { value: 1 });
    expect(calls).toEqual(["handler", "listener"]);

    dispatcher.dispatch("change", { value: 2 });
    expect(calls).toEqual(["handler", "listener", "handler"]);
  });

  it("warns only when one singular handler replaces another", () => {
    const dispatcher = new EventDispatcher<TestEventMap>();
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const first = () => {};
    const second = () => {};

    try {
      dispatcher.setHandler("change", first);
      dispatcher.setHandler("change", undefined);
      dispatcher.setHandler("change", first);
      expect(warn).not.toHaveBeenCalled();

      dispatcher.setHandler("change", second);

      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain(
        "onchange handler replaced",
      );
    } finally {
      warn.mockRestore();
    }
  });
});
