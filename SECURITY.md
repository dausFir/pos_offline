# Keamanan Rilis RapiPos

RapiPos adalah aplikasi offline-first. Binary rilis dibangun dengan Go strip flags dan `garble` untuk meningkatkan biaya reverse engineering, tetapi tidak ada EXE yang sepenuhnya kebal terhadap analisis.

## Aturan wajib

- Jangan taruh private key, password, JWT/AES secret, atau token layanan di source, `.env.example`, frontend, maupun EXE.
- Public key Ed25519 lisensi boleh di-inject saat build; private key harus tetap di mesin penerbit lisensi.
- Build rilis dengan `scripts/build-release.ps1 -LicensePublicKey '<base64-public-key>'`.
- Distribusikan `RapiPos.exe.sha256` bersama EXE dan verifikasi hash sebelum instalasi.
- Untuk distribusi komersial, sign `RapiPos.exe` dan installer menggunakan sertifikat code-signing Windows.

Frontend React berjalan di browser dan karenanya dapat dibaca pengguna; jangan pernah meletakkan aturan lisensi, secret, atau otorisasi di frontend saja. Validasi lisensi dan device binding harus tetap berada di backend.
