<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Attribute\MapQueryParameter;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use Sabre\VObject;

class IcalController extends AbstractController
{
    #[Route('/parse', name: 'app_ical')]
    public function index(
        #[MapQueryParameter(filter: \FILTER_VALIDATE_URL)] string $source,
        #[MapQueryParameter] string                               $start,
        #[MapQueryParameter] string                               $end,
        HttpClientInterface                                       $httpClient,
    ): JsonResponse
    {
        $resp = $httpClient->request('GET', $source);
        // Will throw HttpResponseException if there was a problem. Bubbling this upwards is fine.
        $ics = $resp->getContent();
        $cal = VObject\Reader::read($ics, VObject\Reader::OPTION_FORGIVING);
        $cal = $cal->expand(new \DateTime($start), new \DateTime($end));

        $events = [];
        foreach ($cal->VEVENT as $event) {
            $events[] = [
                'id' => $event->UID->getValue(),
                'title' => $event->SUMMARY->getValue(),
                'location' => $event->LOCATION->getValue(),
                'start' => $event->DTSTART->getDateTime()->format('c'),
                'end' => $event->DTEND->getDateTime()->format('c'),
                'allDay' => (count($event->select('X-MICROSOFT-CDO-ALLDAYEVENT')) > 0 && $event->select('X-MICROSOFT-CDO-ALLDAYEVENT')[0]->getValue() == 'TRUE'),
            ];
        }

        return $this->json($events);
    }
}
