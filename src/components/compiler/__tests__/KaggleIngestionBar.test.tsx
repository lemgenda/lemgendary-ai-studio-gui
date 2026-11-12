// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KaggleIngestionBar } from "../KaggleIngestionBar";
import { kaggleAuthSources } from "../useKaggleIngestionSources";
import * as client from "../../../api/client";

vi.mock("../../../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../api/client")>();
  return {
    ...actual,
    fetchKaggleStatus: vi.fn(),
    fetchKaggleRegistryDatasets: vi.fn(),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocked = vi.mocked(client);

const AUTHENTICATED = {
  authenticated: true,
  auth_methods: { environment_variables: false, secrets_vault: true, user_access_token: true, user_kaggle_json: true },
};

const REGISTRY_ITEM = {
  key: "upn_v2",
  title: "UPN v2",
  name: "upn_v2",
  modernized_folder: "LemGendizedUpnV2",
  kaggle_ref: "https://www.kaggle.com/datasets/owner/lemgendizedupnv2",
  clean_repo_id: "owner/lemgendizedupnv2",
  is_local_present: false,
  canonical_format: "webdataset",
  sample_count: 0,
  size_gb: 0,
};

describe("kaggleAuthSources", () => {
  it("lists the credential sources the compiler found", () => {
    expect(kaggleAuthSources(AUTHENTICATED)).toEqual(["secrets vault", "~/.kaggle/access_token", "kaggle.json (legacy)"]);
  });
});

describe("KaggleIngestionBar", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onChangeCustomKaggleRef = vi.fn();
  const onChangeDownloadTargetFolder = vi.fn();

  const render = async (online: boolean) => {
    await act(async () => {
      root.render(
        <KaggleIngestionBar
          customKaggleRef=""
          onChangeCustomKaggleRef={onChangeCustomKaggleRef}
          downloadTargetFolder=""
          onChangeDownloadTargetFolder={onChangeDownloadTargetFolder}
          downloadForce={false}
          onToggleDownloadForce={vi.fn()}
          isDownloadingKaggle={false}
          downloadStatus={null}
          onDownloadKaggleDirect={vi.fn()}
          datasetCompilerOnline={online}
        />
      );
    });
  };

  beforeEach(() => {
    mocked.fetchKaggleStatus.mockResolvedValue(AUTHENTICATED);
    mocked.fetchKaggleRegistryDatasets.mockResolvedValue([REGISTRY_ITEM]);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("does not query the compiler while it is offline", async () => {
    await render(false);
    expect(mocked.fetchKaggleStatus).not.toHaveBeenCalled();
    expect(mocked.fetchKaggleRegistryDatasets).not.toHaveBeenCalled();
    expect(document.getElementById("comp-badge-kaggle-auth")?.textContent).toBe("Kaggle: compiler offline");
    expect((document.getElementById("comp-select-kaggle-registry") as HTMLSelectElement).disabled).toBe(true);
  });

  it("shows the credential state and fills the reference and folder from a registry pick", async () => {
    await render(true);
    expect(document.getElementById("comp-badge-kaggle-auth")?.textContent).toBe("Kaggle: credentials found");
    const select = document.getElementById("comp-select-kaggle-registry") as HTMLSelectElement;
    expect(select.disabled).toBe(false);
    await act(async () => {
      select.value = REGISTRY_ITEM.kaggle_ref;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onChangeCustomKaggleRef).toHaveBeenCalledWith(REGISTRY_ITEM.kaggle_ref);
    expect(onChangeDownloadTargetFolder).toHaveBeenCalledWith("LemGendizedUpnV2");
  });
});
