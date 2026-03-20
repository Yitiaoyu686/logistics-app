from __future__ import annotations

import re
from pathlib import Path
from typing import Dict, List, Tuple

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
CLIENT_APP = ROOT / "client" / "src" / "App.tsx"
APP_APP = ROOT / "app" / "src" / "App.tsx"
CLIENT_API = ROOT / "client" / "src" / "api" / "index.ts"
APP_API = ROOT / "app" / "src" / "api" / "index.ts"
OUT_XLSX = ROOT / "docs" / "功能清单_Web_App.xlsx"

ALL_WEB_ROLES = [
    "ADMIN",
    "SALES",
    "WAREHOUSE_CN",
    "OPS_CN",
    "OPS_US",
    "WAREHOUSE_US",
    "FINANCE",
    "BOSS",
]


def strip_comments(ts: str) -> str:
    ts = re.sub(r"/\*[\s\S]*?\*/", "", ts)
    ts = re.sub(r"//.*", "", ts)
    return ts


def parse_import_map(app_file: Path, page_prefixes: Tuple[str, ...]) -> Dict[str, Path]:
    text = app_file.read_text(encoding="utf-8")
    imports: Dict[str, Path] = {}
    pattern = re.compile(r"import\s+([\s\S]*?)\s+from\s+'([^']+)'\s*;?")

    for m in pattern.finditer(text):
        raw_names = m.group(1).strip()
        source = m.group(2)
        if not source.startswith(page_prefixes):
            continue

        names: List[str] = []
        if raw_names.startswith("{"):
            body = raw_names.strip("{} \n")
            for part in body.split(","):
                part = part.strip()
                if not part:
                    continue
                if " as " in part:
                    names.append(part.split(" as ")[1].strip())
                else:
                    names.append(part)
        else:
            if "," in raw_names:
                first = raw_names.split(",", 1)[0].strip()
                if first:
                    names.append(first)
            else:
                names.append(raw_names)

        if source.startswith("./"):
            base = (app_file.parent / source).resolve()
        elif source.startswith("@/"):
            # app uses @ -> app/src
            base = (ROOT / "app" / "src" / source[2:]).resolve()
        else:
            continue

        candidates = [
            base.with_suffix(".tsx"),
            base.with_suffix(".ts"),
            base / "index.tsx",
            base / "index.ts",
        ]
        resolved = None
        for c in candidates:
            if c.exists():
                resolved = c
                break
        if resolved is None:
            resolved = candidates[0]

        for n in names:
            imports[n] = resolved

    return imports


def parse_api_map(api_file: Path) -> Dict[str, Tuple[str, str]]:
    text = api_file.read_text(encoding="utf-8")
    api_map: Dict[str, Tuple[str, str]] = {}

    obj_pattern = re.compile(r"export const (\w+)\s*=\s*\{([\s\S]*?)\n\};")
    fn_pattern = re.compile(
        r"(\w+)\s*:\s*\([^)]*\)\s*=>\s*api\.(get|post|put|delete)\(([^\)]*)\)",
        re.MULTILINE,
    )

    for obj in obj_pattern.finditer(text):
        obj_name = obj.group(1)
        body = obj.group(2)
        for fn in fn_pattern.finditer(body):
            method_name = fn.group(1)
            http = fn.group(2).upper()
            arg_part = fn.group(3)
            endpoint_m = re.search(r"(`[^`]+`|'[^']+'|\"[^\"]+\")", arg_part)
            if not endpoint_m:
                continue
            endpoint = endpoint_m.group(1).strip("`'\"")
            api_map[f"{obj_name}.{method_name}"] = (http, endpoint)

    return api_map


def collect_component_data(file_path: Path | None, api_map: Dict[str, Tuple[str, str]]) -> Tuple[List[str], List[str]]:
    if not file_path or not file_path.exists():
        return [], []

    text = file_path.read_text(encoding="utf-8", errors="ignore")
    calls = re.findall(r"([A-Za-z0-9_]+Api)\.([A-Za-z0-9_]+)", text)

    reads: List[str] = []
    writes: List[str] = []
    for api_obj, fn in calls:
        key = f"{api_obj}.{fn}"
        if key not in api_map:
            continue
        http, endpoint = api_map[key]
        item = f"{http} {endpoint}"
        if http == "GET":
            reads.append(item)
        else:
            writes.append(item)

    return sorted(set(reads)), sorted(set(writes))


def infer_status(component: str, file_path: Path | None, reads: List[str], writes: List[str]) -> str:
    if component == "ComingSoon" or file_path is None or not file_path.exists():
        return "规划中（占位）"
    if writes:
        return "已实现（读写API）"
    if reads:
        return "已实现（只读API）"
    return "已实现（本地逻辑/静态）"


def web_module_from_key(key: str) -> str:
    if key.startswith("dashboard"):
        return "工作台"
    if key.startswith("crm"):
        return "客户中心"
    if key.startswith("oms"):
        return "订单中心"
    if key.startswith("wms_dest") or key.startswith("wms_delivery"):
        return "到达国仓储"
    if key.startswith("wms"):
        return "起运国仓储"
    if key.startswith("tms_dest"):
        return "到达国办"
    if key.startswith("tms"):
        return "起运国办"
    if key.startswith("fin"):
        return "财务中心"
    if key.startswith("analytics"):
        return "经营分析"
    if key.startswith("set"):
        return "系统设置"
    return "其他"


def web_roles_for_key(key: str, explicit_roles: Dict[str, List[str]]) -> List[str]:
    if key in explicit_roles:
        return explicit_roles[key]

    if key in {"fin_petty_apply"}:
        return ["SALES", "WAREHOUSE_CN", "OPS_CN", "OPS_US", "WAREHOUSE_US", "FINANCE", "ADMIN"]

    module = web_module_from_key(key)
    defaults = {
        "工作台": ALL_WEB_ROLES,
        "客户中心": ["SALES", "OPS_CN", "ADMIN"],
        "订单中心": ["SALES", "WAREHOUSE_CN", "OPS_CN", "OPS_US", "WAREHOUSE_US", "ADMIN"],
        "起运国仓储": ["WAREHOUSE_CN", "OPS_CN", "ADMIN"],
        "到达国仓储": ["WAREHOUSE_US", "OPS_US", "ADMIN"],
        "起运国办": ["OPS_CN", "ADMIN", "SALES"],
        "到达国办": ["OPS_US", "ADMIN"],
        "财务中心": ["FINANCE", "ADMIN", "BOSS"],
        "经营分析": ["BOSS", "ADMIN"],
        "系统设置": ["ADMIN"],
    }
    return defaults.get(module, ALL_WEB_ROLES)


def parse_web_features() -> List[dict]:
    text = CLIENT_APP.read_text(encoding="utf-8")
    imports = parse_import_map(CLIENT_APP, ("./pages/",))
    api_map = parse_api_map(CLIENT_API)

    mapping: Dict[str, str] = {}
    for m in re.finditer(r"if\s*\(tabKey\s*===\s*'([^']+)'\)\s*return\s*<([A-Za-z0-9_]+)", text):
        mapping[m.group(1)] = m.group(2)
    for m in re.finditer(r"case\s*'([^']+)'\s*:\s*return\s*<([A-Za-z0-9_]+)", text):
        mapping[m.group(1)] = m.group(2)

    menu_block_m = re.search(r"const MENU_CONFIG:[\s\S]*?=\s*\[([\s\S]*?)\n\];", text)
    menu_block = menu_block_m.group(1) if menu_block_m else text
    menu_text = strip_comments(menu_block)

    key_label: Dict[str, str] = {}
    explicit_roles: Dict[str, List[str]] = {}
    key_label_pattern = re.compile(r"\{\s*key:\s*'([^']+)'\s*,\s*label:\s*'([^']+)'(?:,\s*roles:\s*\[([^\]]+)\])?")
    for m in key_label_pattern.finditer(menu_text):
        key = m.group(1)
        label = m.group(2)
        key_label[key] = label
        if m.group(3):
            explicit_roles[key] = re.findall(r"'([^']+)'", m.group(3))

    feature_keys = set(mapping.keys())
    # MENU 里存在但当前未接入 renderer 的占位页
    for k in key_label:
        if k.startswith("set_message_"):
            feature_keys.add(k)

    rows: List[dict] = []
    for key in sorted(feature_keys):
        label = key_label.get(key, key)
        component = mapping.get(key, "ComingSoon")
        file_path = imports.get(component)

        reads, writes = collect_component_data(file_path, api_map)
        status = infer_status(component, file_path, reads, writes)

        module = web_module_from_key(key)
        roles = web_roles_for_key(key, explicit_roles)
        roles_text = ",".join(roles)

        desc = f"{label}功能页，支持{module}相关业务处理。"
        if writes:
            desc = f"{label}功能页，支持{module}数据查询与业务提交。"

        scene = f"{roles_text} 在 {module} 场景下使用“{label}”完成日常作业。"

        rows.append(
            {
                "端": "Web",
                "模块": module,
                "功能标识": key,
                "功能名称": label,
                "页面组件": component,
                "代码位置": str(file_path.relative_to(ROOT)) if file_path else "-",
                "使用角色": roles_text,
                "功能描述": desc,
                "使用场景": scene,
                "状态": status,
                "数据来源": "；".join(reads) if reads else "-",
                "数据去向": "；".join(writes) if writes else "-",
            }
        )

    return rows


def app_module_from_path(path: str) -> str:
    if path in {"/login", "/warehouse-select", "/"}:
        return "认证与入口"
    if path.startswith("/sales/"):
        return "销售端"
    if path.startswith("/warehouse-us/"):
        return "到达国仓"
    if path.startswith("/profile"):
        return "个人中心"
    if path.startswith("/inbound") or path.startswith("/packing") or path.startswith("/transfer") or path.startswith("/stock") or path.startswith("/container") or path.startswith("/no-order-express") or path.startswith("/express") or path.startswith("/return") or path.startswith("/scan-order"):
        return "起运国仓"
    if path in {"/dashboard", "/task-hub"}:
        return "起运国仓"
    return "通用"


def app_roles_for_path(path: str) -> str:
    if path in {"/login", "/warehouse-select"}:
        return "PUBLIC"
    if path == "/":
        return "SALES,WAREHOUSE_US,WAREHOUSE_CN"
    if path.startswith("/sales/"):
        return "SALES"
    if path.startswith("/warehouse-us/"):
        return "WAREHOUSE_US"
    return "WAREHOUSE_CN"


def app_label_from_path(path: str) -> str:
    mapping = {
        "/login": "登录",
        "/warehouse-select": "仓库选择",
        "/dashboard": "起运国工作台",
        "/task-hub": "起运国任务中心",
        "/profile": "个人中心",
        "/inbound/pending": "待入库列表",
        "/inbound/scan": "扫码入库",
        "/inbound/form": "入库登记",
        "/inbound/success": "入库成功",
        "/inbound/print": "入库打印",
        "/packing/scan": "装箱扫码",
        "/packing/records": "装箱记录",
        "/transfer/create": "调拨创建",
        "/inbound/history": "入库历史",
        "/container/create": "运输单元创建",
        "/no-order-express": "无订单快递",
        "/return-records": "退运记录",
        "/scan-order": "扫码查件",
        "/warehouse-us/dashboard": "到达国工作台",
        "/warehouse-us/task-hub": "到达国任务中心",
        "/warehouse-us/inbound/scan": "到达国扫码入库",
        "/warehouse-us/inbound/records": "到达国入库记录",
        "/warehouse-us/delivery/create": "配送创建",
        "/warehouse-us/delivery/list": "配送列表",
        "/warehouse-us/container/list": "集装箱任务列表",
        "/warehouse-us/transfer/create": "到达国调拨创建",
        "/warehouse-us/transfer/list": "到达国调拨列表",
        "/warehouse-us/scan-order": "到达国扫码查件",
        "/sales/dashboard": "销售工作台",
        "/sales/task-hub": "销售任务中心",
        "/sales/profile": "销售个人中心",
        "/sales/order/create": "销售创建订单",
        "/sales/quote": "报价工具",
        "/": "角色分流入口",
    }
    if path in mapping:
        return mapping[path]

    if path.endswith("/:id") or "/:" in path:
        return f"详情页（{path}）"
    return f"页面（{path}）"


def parse_app_routes() -> List[Tuple[str, str]]:
    text = APP_APP.read_text(encoding="utf-8")
    imports = parse_import_map(APP_APP, ("@/pages/",))

    routes: List[Tuple[str, str]] = []
    route_pat = re.compile(r'path="([^"]+)"')
    tag_pat = re.compile(r"<([A-Za-z_][A-Za-z0-9_]*)")

    imported_names = set(imports.keys())

    for m in route_pat.finditer(text):
        path = m.group(1)
        prefix = text[max(0, m.start() - 160):m.start()]
        if "<Route" not in prefix:
            continue

        comp = None
        suffix = text[m.end():m.end() + 2000]
        for tag in tag_pat.findall(suffix):
            if tag in imported_names:
                comp = tag
                break
            if comp:
                break
        if not comp and path == "/":
            comp = "RoleRedirect"
        routes.append((path, comp or "Unknown"))

    # 去重（同一路由可能重复扫描到）
    seen = set()
    uniq: List[Tuple[str, str]] = []
    for path, comp in routes:
        key = (path, comp)
        if key in seen:
            continue
        seen.add(key)
        uniq.append((path, comp))
    return uniq


def parse_app_features() -> List[dict]:
    imports = parse_import_map(APP_APP, ("@/pages/",))
    api_map = parse_api_map(APP_API)
    rows: List[dict] = []

    for path, component in parse_app_routes():
        file_path = imports.get(component)
        reads, writes = collect_component_data(file_path, api_map)

        if component == "RoleRedirect":
            status = "已实现（路由分流）"
        else:
            status = infer_status(component, file_path, reads, writes)

        module = app_module_from_path(path)
        roles = app_roles_for_path(path)
        label = app_label_from_path(path)

        desc = f"{label}，用于{module}流程操作。"
        if writes:
            desc = f"{label}，支持{module}读写联动与现场作业提交。"

        scene = f"{roles} 角色在 App 的 {module} 场景中使用“{label}”。"

        rows.append(
            {
                "端": "App",
                "模块": module,
                "功能标识": path,
                "功能名称": label,
                "页面组件": component,
                "代码位置": str(file_path.relative_to(ROOT)) if file_path else "app/src/App.tsx",
                "使用角色": roles,
                "功能描述": desc,
                "使用场景": scene,
                "状态": status,
                "数据来源": "；".join(reads) if reads else "-",
                "数据去向": "；".join(writes) if writes else "-",
            }
        )

    return rows


def main() -> None:
    web_rows = parse_web_features()
    app_rows = parse_app_features()

    web_df = pd.DataFrame(web_rows)
    app_df = pd.DataFrame(app_rows)
    all_df = pd.concat([web_df, app_df], ignore_index=True)

    # 排序便于阅读
    web_df = web_df.sort_values(["模块", "功能名称", "功能标识"]).reset_index(drop=True)
    app_df = app_df.sort_values(["模块", "功能名称", "功能标识"]).reset_index(drop=True)
    all_df = all_df.sort_values(["端", "模块", "功能名称", "功能标识"]).reset_index(drop=True)

    OUT_XLSX.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(OUT_XLSX, engine="openpyxl") as writer:
        all_df.to_excel(writer, sheet_name="功能清单_总览", index=False)
        web_df.to_excel(writer, sheet_name="功能清单_Web", index=False)
        app_df.to_excel(writer, sheet_name="功能清单_App", index=False)

    print(f"generated: {OUT_XLSX}")
    print(f"web_rows={len(web_df)}, app_rows={len(app_df)}, total={len(all_df)}")


if __name__ == "__main__":
    main()
