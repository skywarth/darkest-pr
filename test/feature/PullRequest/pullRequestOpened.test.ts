import {describe, expect, test, beforeEach, afterEach, vi, beforeAll, Mock, MockInstance} from "vitest";
import {Probot, ProbotOctokit} from "probot";
import nock from "nock";
import DarkestPR from "../../../src/index";
import {QuoteFacade} from "../../../src/Quote/QuoteFacade";
import {CommentFactory} from "../../../src/Comment/CommentFactory";
import Comment from "../../../src/Comment/Comment";
import {CaseSlugs} from "../../../src/enums/CaseSlug";
import PullRequestOpenedStrategy from "../../../src/ActionHandler/PullRequest/PullRequestOpenedStrategy";




import pullRequestOpenedPayload from '../../fixtures/events/pull_request/pull_request.opened.json';
import pullRequestListNotMerged from '../../fixtures/data/pulls/pulls.list.not-merged.json';
import pullRequestListMerged from '../../fixtures/data/pulls/pulls.list.merged.json';



describe("Pull Request Opened Tests", () => {
    let probot: Probot;

    let quoteFacadeGetQuoteSpy:MockInstance;
    let commentFactoryCreateSpy: MockInstance;
    let prOpenedStrategyExecutePrStrategySpy: MockInstance;
    let createCommentEndpointMock:Mock=vi.fn();
    let pullRequestIndexResponseMock:Mock=vi.fn();

    const initializeMocks = () => {
        probot=new Probot({
            githubToken: "test",
            Octokit: ProbotOctokit.defaults(function(instanceOptions:any) {//this POS costed me around 2.5 hours, damn!
                return {
                    ...instanceOptions,//not really necessary
                    retry: { enabled: false },
                    throttle: { enabled: false },
                }
            }),
        });
        DarkestPR(probot);


        quoteFacadeGetQuoteSpy = vi.spyOn(QuoteFacade.prototype, 'getQuote');
        commentFactoryCreateSpy = vi.spyOn(CommentFactory.prototype, 'create');
        prOpenedStrategyExecutePrStrategySpy = vi.spyOn(PullRequestOpenedStrategy.prototype as any, 'executePrStrategy');
        createCommentEndpointMock.mockImplementation((param: any) => param);
    };

    const setupEndpointMocks = () => {
        const endpointRoot:string='https://api.github.com';

        nock(endpointRoot)
            .get('/repos/test-owner/test-repo/pulls')
            .query(true)
            .reply(200, pullRequestIndexResponseMock);

        nock(endpointRoot)
            .post('/repos/test-owner/test-repo/issues/1/comments', createCommentEndpointMock)
            .reply(200);
        nock(endpointRoot)
            .get('/repos/test-owner/test-repo/contents/.darkest-pr.json')
            .reply(200, {
                content: Buffer.from(JSON.stringify({/* config object*/ })).toString('base64')
            });
    };

    beforeAll(() => {
        nock.disableNetConnect();
        initializeMocks();
    });

    beforeEach(() => {
    });

    afterEach(() => {
        nock.cleanAll();
        vi.clearAllMocks();
    });

    describe.each([
        {
            description: "No previous PRs",
            previousPrs: [],
            expectedCaseSlug: CaseSlugs.PullRequest.Opened.Fresh,
        },
        {
            description: "Previously not merged (closed)",
            previousPrs: pullRequestListNotMerged,
            expectedCaseSlug: CaseSlugs.PullRequest.Opened.PreviouslyClosed,
        },
        {
            description: "Previously merged",
            previousPrs: pullRequestListMerged,
            expectedCaseSlug: CaseSlugs.PullRequest.Opened.PreviouslyMerged,
        },
    ])('$description', ({ previousPrs, expectedCaseSlug }) => {
        beforeEach(() => {
            setupEndpointMocks();
        });

        test('Creates a comment after receiving the event', async () => {
            pullRequestIndexResponseMock.mockImplementation(()=>previousPrs);

            await probot.receive({
                id: '123',
                name: 'pull_request',
                payload: pullRequestOpenedPayload as any,
            });





            expect(pullRequestIndexResponseMock).toHaveBeenCalledOnce();

            expect(prOpenedStrategyExecutePrStrategySpy).toHaveBeenCalled();
            expect(quoteFacadeGetQuoteSpy).toHaveBeenCalled();
            expect(commentFactoryCreateSpy).toHaveBeenCalled();
            const commentInstance: Comment = commentFactoryCreateSpy.mock.results[0].value;
            expect(commentInstance).toBeInstanceOf(Comment);
            expect(expectedCaseSlug).toBe(commentInstance.caseSlug);

            const sentData = createCommentEndpointMock.mock.results[0]?.value ?? {};
            expect(createCommentEndpointMock).toHaveBeenCalledOnce();
            expect(sentData).toHaveProperty('body');
            expect(sentData.body).toBeTypeOf('string');
            expect(sentData.body.length).toBeGreaterThan(0);
        });
    });
});