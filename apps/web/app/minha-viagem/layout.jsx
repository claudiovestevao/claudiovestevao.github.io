export default function MinhaViagemLayout({ children }) {
  return (
    <>
      {children}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            if ("serviceWorker" in navigator) {
              window.addEventListener("load", function () {
                navigator.serviceWorker.register("/sw.js", { scope: "/minha-viagem" }).catch(function () {});
              });
            }
          `
        }}
      />
    </>
  );
}
