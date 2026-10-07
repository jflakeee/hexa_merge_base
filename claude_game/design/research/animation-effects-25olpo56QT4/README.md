# 게임 애니메이션 효과 영상 분석·개발 리서치

작성: 2026-10-05 · 대상 프로젝트: ClaudeGame, Phaser 3.90.0

- [영상 분석: 30가지 효과와 장면별 근거](analysis.md)
- [개발 심층 리서치: 구조·적용 우선순위·검증 기준](game-development-research.md)
- [전체 영상 MP4](media/reference.mp4)
- [전체 장면 모음](contact-sheet.jpg)
- [다운로드 검증 정보](download-manifest.json)

원본: 웹핵, [AI로 만든 게임이 아마추어처럼 보이는 진짜 이유](https://www.youtube.com/watch?v=25olpo56QT4).

Playwright로 공개 재생 페이지·메타데이터를 확인하고 MSE 스트림 다운로드를 시도했다. 약 1분 이후 수집이 멈춰 전체 파일은 yt-dlp와 FFmpeg로 보완했다. 따라서 **전체 다운로드를 Playwright만으로 완료한 것은 아니다.** `media/stream-*`는 불완전한 중간 파일이며 분석용 완성본은 `media/reference.mp4`다.

완성본: 1280×720, 212.661초, 7,572,578바이트, AV1 영상·Opus 오디오. FFprobe 전체 프레임 읽기에서 영상 6,379프레임을 확인했다. 주요 장면 22장과 효과 설명 구간의 초 단위 75장을 추출해 직접 검토했다. 한국어 자동 자막도 확보했으나 음성을 별도로 청취·검수한 전사본은 아니다. 정지 프레임으로 정확한 히트스톱 지속시간이나 이징 계수를 측정했다고 주장하지 않는다.

이 문서는 연구 결과와 구현 제안이다. 이번 작업에서 게임 기능을 수정하거나 배포하지 않았다. 내려받은 영상과 자막은 로컬 분석 자료로 보관하며 배포 산출물에 포함하지 않는다.

재현 스크립트: `scripts/analyze-video.cjs`, `scripts/capture-video.cjs`, `scripts/extract-research-frames.py`, `scripts/extract-effect-cards.py` (프로젝트 루트 기준). Playwright 스크립트의 모듈 경로는 현재 Windows 환경에 맞춰져 있다.
