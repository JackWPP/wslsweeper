import argparse
import threading
import time
import webbrowser


def main():
    parser = argparse.ArgumentParser(
        description="WSL2 存储空间清理可视化工具",
        prog="wslsweeper",
    )
    parser.add_argument("--port", type=int, default=8765, help="端口号 (默认: 8765)")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="绑定地址")
    parser.add_argument("--no-browser", action="store_true", help="不自动打开浏览器")
    args = parser.parse_args()

    if not args.no_browser:
        url = f"http://{args.host}:{args.port}"

        def open_browser():
            time.sleep(1.5)
            webbrowser.open(url)

        threading.Thread(target=open_browser, daemon=True).start()

    import uvicorn

    uvicorn.run(
        "wslsweeper.server:create_app",
        factory=True,
        host=args.host,
        port=args.port,
        log_level="warning",
    )


if __name__ == "__main__":
    main()
